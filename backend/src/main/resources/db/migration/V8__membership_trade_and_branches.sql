-- Software business workflow only. No row here constitutes a payment receipt.
ALTER TABLE xq_centers ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
CREATE INDEX xq_centers_parent ON xq_centers(parent_id);
ALTER TABLE xq_identities ADD CONSTRAINT xq_identity_center_unique UNIQUE(center_id,id);
CREATE TABLE xq_membership_plans (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 role_id varchar(40) NOT NULL REFERENCES xq_roles(id), name varchar(120) NOT NULL,
 fee_fen bigint NOT NULL CHECK(fee_fen BETWEEN 0 AND 99900),
 valid_days integer NOT NULL CHECK(valid_days BETWEEN 1 AND 3660),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(role_id NOT IN ('center_admin','support','content_admin')),
 CHECK(role_id NOT IN ('farmer','cooperative') OR fee_fen=0), UNIQUE(center_id,id)
);
CREATE TABLE xq_memberships (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 identity_id varchar(64) NOT NULL,
 applicant_id varchar(64) NOT NULL REFERENCES xq_accounts(id),
 plan_id varchar(64) NOT NULL, fee_fen bigint NOT NULL CHECK(fee_fen BETWEEN 0 AND 99900),
 reason varchar(2000) NOT NULL, review_note varchar(2000),
 status varchar(30) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','awaiting_payment','rejected','cancelled')),
 expires_at timestamptz, reviewer_id varchar(64) REFERENCES xq_accounts(id),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,plan_id) REFERENCES xq_membership_plans(center_id,id),
 FOREIGN KEY(center_id,identity_id) REFERENCES xq_identities(center_id,id),
 CHECK(status!='active' OR (fee_fen=0 AND expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX xq_membership_outstanding ON xq_memberships(identity_id) WHERE status IN ('pending','awaiting_payment');
CREATE INDEX xq_membership_owner ON xq_memberships(center_id,identity_id,created_at,id);
CREATE INDEX xq_membership_plan ON xq_memberships(plan_id);
CREATE INDEX xq_membership_plans_center_role ON xq_membership_plans(center_id,role_id);
ALTER TABLE xq_stock_batches ADD COLUMN plot_id varchar(64);
ALTER TABLE xq_stock_batches ADD COLUMN creator_id varchar(64) REFERENCES xq_accounts(id);
ALTER TABLE xq_stock_batches ADD COLUMN unit_price_fen_kg bigint CHECK(unit_price_fen_kg BETWEEN 1 AND 10000000);
ALTER TABLE xq_stock_batches ADD COLUMN created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE xq_stock_batches ADD CONSTRAINT xq_batch_plot_fk FOREIGN KEY(center_id,plot_id) REFERENCES xq_plots(center_id,id);
ALTER TABLE xq_plots ADD CONSTRAINT xq_plot_owner_unique UNIQUE(center_id,subject_id,id);
ALTER TABLE xq_stock_batches ADD CONSTRAINT xq_batch_plot_owner_fk FOREIGN KEY(center_id,subject_id,plot_id) REFERENCES xq_plots(center_id,subject_id,id);
CREATE INDEX xq_stock_owner ON xq_stock_batches(center_id,subject_id,created_at,id);
CREATE INDEX xq_stock_plot ON xq_stock_batches(plot_id);
CREATE TABLE xq_trade_orders (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 batch_id varchar(64) NOT NULL, buyer_subject_id varchar(64) NOT NULL,
 buyer_id varchar(64) NOT NULL REFERENCES xq_accounts(id),
 quantity_kg numeric(14,3) NOT NULL CHECK(quantity_kg>0),
 unit_price_fen_kg bigint NOT NULL CHECK(unit_price_fen_kg BETWEEN 1 AND 10000000),
 amount_fen bigint NOT NULL CHECK(amount_fen BETWEEN 1 AND 1000000000000),
 status varchar(30) NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','seller_confirmed','dispatched','accepted','disputed','cancelled')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,batch_id) REFERENCES xq_stock_batches(center_id,id),
 FOREIGN KEY(center_id,buyer_subject_id) REFERENCES xq_subjects(center_id,id), UNIQUE(center_id,id)
);
CREATE INDEX xq_trade_owner ON xq_trade_orders(center_id,buyer_subject_id,created_at,id);
CREATE INDEX xq_trade_batch ON xq_trade_orders(batch_id);
CREATE TABLE xq_handover_events (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, order_id varchar(64) NOT NULL,
 identity_id varchar(64) NOT NULL REFERENCES xq_identities(id), actor_id varchar(64) NOT NULL REFERENCES xq_accounts(id),
 action varchar(30) NOT NULL CHECK(action IN ('seller-confirm','dispatch','accept','dispute','cancel')),
 note varchar(2000) NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,order_id) REFERENCES xq_trade_orders(center_id,id),
 FOREIGN KEY(center_id,identity_id) REFERENCES xq_identities(center_id,id)
);
CREATE INDEX xq_handover_order ON xq_handover_events(center_id,order_id,created_at,id);
ALTER TABLE xq_merchants ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE xq_merchants ADD COLUMN display_name varchar(120) NOT NULL DEFAULT '待核验商户';
CREATE INDEX xq_merchants_center ON xq_merchants(center_id);
CREATE TABLE xq_settlement_plans (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, order_id varchar(64) NOT NULL UNIQUE,
 platform_merchant_id varchar(64) NOT NULL REFERENCES xq_merchants(id),
 center_merchant_id varchar(64) NOT NULL REFERENCES xq_merchants(id),
 platform_rate_bps integer NOT NULL CHECK(platform_rate_bps BETWEEN 0 AND 10000),
 source_amount_fen bigint NOT NULL CHECK(source_amount_fen>0),
 amount_fen bigint NOT NULL CHECK(amount_fen>0), platform_amount_fen bigint NOT NULL CHECK(platform_amount_fen>=0),
 center_amount_fen bigint NOT NULL CHECK(center_amount_fen>=0),
 status varchar(30) NOT NULL DEFAULT 'blocked_external' CHECK(status='blocked_external'),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,order_id) REFERENCES xq_trade_orders(center_id,id),
 CHECK(platform_amount_fen+center_amount_fen=amount_fen), CHECK(amount_fen<=source_amount_fen)
);
CREATE INDEX xq_settlement_center ON xq_settlement_plans(center_id,created_at,id);
CREATE FUNCTION xq_reject_workflow_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Workflow evidence is append-only'; END $$;
CREATE TRIGGER xq_handover_immutable BEFORE UPDATE OR DELETE ON xq_handover_events FOR EACH ROW EXECUTE FUNCTION xq_reject_workflow_history_change();
CREATE TRIGGER xq_membership_plan_immutable BEFORE UPDATE OR DELETE ON xq_membership_plans FOR EACH ROW EXECUTE FUNCTION xq_reject_workflow_history_change();
CREATE TRIGGER xq_settlement_plan_immutable BEFORE UPDATE OR DELETE ON xq_settlement_plans FOR EACH ROW EXECUTE FUNCTION xq_reject_workflow_history_change();
-- Roles are definitions, not grants to accounts. A fresh database needs these before bootstrap.
INSERT INTO xq_roles(id,name) VALUES
 ('farmer','种植户'),('cooperative','合作社'),('team','农服队'),('machine','农机服务'),('protection','植保队'),
 ('supplier','农资商'),('buyer','采购商'),('warehouse','冷库'),('processor','加工分拣'),('lab','检测机构'),
 ('family','家庭代办'),('consumer','消费者'),('center_admin','中心管理员'),('support','客服坐席'),('content_admin','内容管理员') ON CONFLICT DO NOTHING;
INSERT INTO xq_role_permissions(role_id,permission)
 SELECT r.id,p.permission FROM xq_roles r CROSS JOIN (VALUES('membership.read'),('membership.apply')) p(permission)
 WHERE r.id NOT IN ('center_admin','support','content_admin') ON CONFLICT DO NOTHING;
INSERT INTO xq_role_permissions(role_id,permission) VALUES
 ('center_admin','membership.manage'),('center_admin','branches.manage'),('center_admin','trade.manage'),('center_admin','finance.manage'),
 ('farmer','stock.write'),('farmer','trade.read'),('cooperative','stock.write'),('cooperative','trade.read'),
 ('buyer','trade.read'),('buyer','trade.buy') ON CONFLICT DO NOTHING;
