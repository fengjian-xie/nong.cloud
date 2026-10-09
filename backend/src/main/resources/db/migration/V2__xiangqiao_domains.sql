-- V1 is retained unchanged. Business data uses typed, tenant-scoped tables.
CREATE TABLE xq_centers (
 id varchar(64) PRIMARY KEY, name varchar(120) NOT NULL, county_code varchar(12) NOT NULL,
 parent_id varchar(64) REFERENCES xq_centers(id), status varchar(20) NOT NULL DEFAULT 'active',
 CHECK (status IN ('active','suspended'))
);
CREATE TABLE xq_people (id varchar(64) PRIMARY KEY);
CREATE TABLE xq_accounts (
 id varchar(64) PRIMARY KEY, person_id varchar(64) NOT NULL REFERENCES xq_people(id),
 username varchar(128) NOT NULL UNIQUE, password_hash varchar(128), display_name varchar(100) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE xq_subjects (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 name varchar(120) NOT NULL, kind varchar(40) NOT NULL, UNIQUE(center_id,id)
);
CREATE TABLE xq_roles (id varchar(40) PRIMARY KEY, name varchar(80) NOT NULL);
CREATE TABLE xq_identities (
 id varchar(64) PRIMARY KEY, account_id varchar(64) NOT NULL REFERENCES xq_accounts(id),
 center_id varchar(64) NOT NULL REFERENCES xq_centers(id), subject_id varchar(64) NOT NULL,
 role_id varchar(40) NOT NULL REFERENCES xq_roles(id),
 status varchar(20) NOT NULL DEFAULT 'approved' CHECK(status IN ('approved','revoked')),
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id),
 UNIQUE(account_id,subject_id,role_id)
);
CREATE TABLE xq_sessions (
 token_hash varchar(64) PRIMARY KEY, account_id varchar(64) NOT NULL REFERENCES xq_accounts(id),
 identity_id varchar(64) NOT NULL REFERENCES xq_identities(id), expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE xq_wechat_accounts (
 appid varchar(64) NOT NULL, openid varchar(128) NOT NULL,
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), PRIMARY KEY(appid,openid)
);
CREATE TABLE xq_plots (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 subject_id varchar(64) NOT NULL, name varchar(120) NOT NULL,
 area_mu numeric(12,4) NOT NULL CHECK(area_mu>0 AND area_mu<=1000000),
 crop varchar(80) NOT NULL, address varchar(300) NOT NULL,
 latitude numeric(10,7) CHECK(latitude BETWEEN -90 AND 90),
 longitude numeric(10,7) CHECK(longitude BETWEEN -180 AND 180),
 status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','archived')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id), UNIQUE(center_id,id),
 CHECK((latitude IS NULL)=(longitude IS NULL))
);
CREATE TABLE xq_seasons (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, plot_id varchar(64) NOT NULL,
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2100), crop varchar(80) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'active', FOREIGN KEY(center_id,plot_id) REFERENCES xq_plots(center_id,id),
 UNIQUE(plot_id,year), UNIQUE(center_id,id)
);
CREATE TABLE xq_plot_changes (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, plot_id varchar(64) NOT NULL,
 requested_by varchar(64) NOT NULL REFERENCES xq_accounts(id), expected_version integer NOT NULL,
 proposed_crop varchar(80) NOT NULL, reason varchar(1000) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewer_id varchar(64) REFERENCES xq_accounts(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,plot_id) REFERENCES xq_plots(center_id,id)
);
CREATE TABLE xq_activities (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, plot_id varchar(64) NOT NULL,
 season_id varchar(64), actor_id varchar(64) NOT NULL REFERENCES xq_accounts(id),
 operation varchar(80) NOT NULL, occurred_at timestamptz NOT NULL, source varchar(20) NOT NULL,
 client_seq varchar(128) NOT NULL, note varchar(2000) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,plot_id) REFERENCES xq_plots(center_id,id),
 FOREIGN KEY(center_id,season_id) REFERENCES xq_seasons(center_id,id),
 CHECK(source IN ('manual','device','service')), UNIQUE(actor_id,client_seq), UNIQUE(center_id,id)
);
CREATE TABLE xq_service_requests (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, plot_id varchar(64) NOT NULL,
 requester_id varchar(64) NOT NULL REFERENCES xq_accounts(id), subject_id varchar(64) NOT NULL,
 operation varchar(80) NOT NULL, scheduled_date date NOT NULL, standard_text varchar(2000) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','claimed','cancelled')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,plot_id) REFERENCES xq_plots(center_id,id),
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id), UNIQUE(center_id,id)
);
CREATE TABLE xq_work_orders (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, request_id varchar(64) NOT NULL UNIQUE,
 provider_id varchar(64) NOT NULL REFERENCES xq_accounts(id), provider_subject_id varchar(64) NOT NULL,
 provider_person_id varchar(64) NOT NULL REFERENCES xq_people(id),
 status varchar(20) NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','working','submitted','accepted','disputed')),
 completion_note varchar(2000), acceptance_note varchar(2000), accepted_by varchar(64) REFERENCES xq_accounts(id),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,request_id) REFERENCES xq_service_requests(center_id,id),
 FOREIGN KEY(center_id,provider_subject_id) REFERENCES xq_subjects(center_id,id), UNIQUE(center_id,id)
);
CREATE TABLE xq_help_tickets (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), identity_id varchar(64) NOT NULL REFERENCES xq_identities(id),
 category varchar(80) NOT NULL, description varchar(2000) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','processing','resolved','closed')),
 reply varchar(2000), version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE xq_messages (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), title varchar(120) NOT NULL,
 body varchar(2000) NOT NULL, category varchar(40) NOT NULL, read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE xq_identity_applications (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), subject_id varchar(64),
 role_id varchar(40) NOT NULL REFERENCES xq_roles(id), subject_name varchar(120) NOT NULL,
 address varchar(300) NOT NULL, reason varchar(2000) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewer_id varchar(64) REFERENCES xq_accounts(id), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id)
);
CREATE TABLE xq_cards (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id), subject_id varchar(64) NOT NULL,
 device_uuid varchar(128) NOT NULL UNIQUE, status varchar(20) NOT NULL DEFAULT 'active',
 binding_version integer NOT NULL DEFAULT 1, desired_config_version integer NOT NULL DEFAULT 1,
 acknowledged_config_version integer NOT NULL DEFAULT 0, abc_config text NOT NULL DEFAULT '{}',
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id), UNIQUE(center_id,id),
 CHECK(acknowledged_config_version<=desired_config_version), CHECK(status IN ('active','lost','retired'))
);
CREATE TABLE xq_card_configurations (
 card_id varchar(64) NOT NULL REFERENCES xq_cards(id), version integer NOT NULL,
 config text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(card_id,version)
);
CREATE TABLE xq_device_events (
 card_id varchar(64) NOT NULL REFERENCES xq_cards(id), event_id varchar(128) NOT NULL,
 binding_version integer NOT NULL, config_version integer NOT NULL, button varchar(10) NOT NULL,
 occurred_at timestamptz NOT NULL, latitude numeric(10,7), longitude numeric(10,7),
 fix_status varchar(30) NOT NULL, received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 payload_hash varchar(64) NOT NULL, PRIMARY KEY(card_id,event_id),
 CHECK(button IN ('start','stop','A','B','C')), CHECK(fix_status IN ('fixed','failed','pending')),
 CHECK(latitude BETWEEN -90 AND 90), CHECK(longitude BETWEEN -180 AND 180),
 CHECK((latitude IS NULL)=(longitude IS NULL)), CHECK(fix_status!='fixed' OR latitude IS NOT NULL)
);
CREATE TABLE xq_news (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 author_id varchar(64) NOT NULL REFERENCES xq_accounts(id), title varchar(150) NOT NULL, body text NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn')),
 version integer NOT NULL DEFAULT 1, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE xq_social_accounts (
 center_id varchar(64) NOT NULL REFERENCES xq_centers(id), channel varchar(20) NOT NULL,
 display_name varchar(100) NOT NULL, url varchar(500), enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(center_id,channel), CHECK(channel IN ('wechat_video','douyin','xiaohongshu'))
);
CREATE TABLE xq_idempotency (
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), identity_id varchar(64) NOT NULL REFERENCES xq_identities(id),
 request_key varchar(128) NOT NULL, payload_hash varchar(64) NOT NULL, response text,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(account_id,identity_id,request_key)
);
CREATE TABLE xq_audit_logs (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 actor_id varchar(64) NOT NULL REFERENCES xq_accounts(id), identity_id varchar(64) NOT NULL REFERENCES xq_identities(id),
 action varchar(80) NOT NULL, object_id varchar(128), trace_id varchar(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Reserved typed schemas, NOT claims that payments/cameras are integrated.
CREATE TABLE xq_stock_batches (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id), subject_id varchar(64) NOT NULL,
 product varchar(80) NOT NULL, grade varchar(40) NOT NULL,
 quantity_kg numeric(14,3) NOT NULL CHECK(quantity_kg>=0),
 reserved_kg numeric(14,3) NOT NULL DEFAULT 0 CHECK(reserved_kg>=0),
 sold_kg numeric(14,3) NOT NULL DEFAULT 0 CHECK(sold_kg>=0),
 version integer NOT NULL DEFAULT 1, CHECK(reserved_kg+sold_kg<=quantity_kg),
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id), UNIQUE(center_id,id)
);
CREATE TABLE xq_batch_sources (
 center_id varchar(64) NOT NULL, batch_id varchar(64) NOT NULL, season_id varchar(64) NOT NULL,
 quantity_kg numeric(14,3) NOT NULL CHECK(quantity_kg>0), PRIMARY KEY(batch_id,season_id),
 FOREIGN KEY(center_id,batch_id) REFERENCES xq_stock_batches(center_id,id),
 FOREIGN KEY(center_id,season_id) REFERENCES xq_seasons(center_id,id)
);
CREATE TABLE xq_cost_entries (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, season_id varchar(64) NOT NULL,
 category varchar(40) NOT NULL, amount_fen bigint NOT NULL CHECK(amount_fen>=0),
 is_cash boolean NOT NULL, source_note varchar(500) NOT NULL,
 FOREIGN KEY(center_id,season_id) REFERENCES xq_seasons(center_id,id)
);
CREATE TABLE xq_merchants (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 sub_mchid varchar(64) NOT NULL UNIQUE, status varchar(20) NOT NULL DEFAULT 'pending'
);
CREATE TABLE xq_payment_orders (
 id varchar(64) PRIMARY KEY, merchant_id varchar(64) NOT NULL REFERENCES xq_merchants(id),
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), amount_fen bigint NOT NULL CHECK(amount_fen>0),
 status varchar(20) NOT NULL DEFAULT 'created', external_transaction_id varchar(128) UNIQUE,
 CHECK(status IN ('created','paid','refunding','refunded','closed'))
);
CREATE TABLE xq_settlement_entries (
 id varchar(64) PRIMARY KEY, payment_order_id varchar(64) NOT NULL REFERENCES xq_payment_orders(id),
 receiver_merchant_id varchar(64) NOT NULL REFERENCES xq_merchants(id), amount_fen bigint NOT NULL CHECK(amount_fen>0),
 external_request_id varchar(128) NOT NULL UNIQUE, status varchar(20) NOT NULL DEFAULT 'pending'
);
CREATE INDEX xq_accounts_person ON xq_accounts(person_id);
CREATE INDEX xq_subjects_center ON xq_subjects(center_id);
CREATE INDEX xq_identities_account ON xq_identities(account_id,status);
CREATE INDEX xq_identities_subject ON xq_identities(center_id,subject_id);
CREATE INDEX xq_sessions_account ON xq_sessions(account_id);
CREATE INDEX xq_sessions_identity ON xq_sessions(identity_id);
CREATE INDEX xq_sessions_expiry ON xq_sessions(expires_at);
CREATE INDEX xq_plots_owner ON xq_plots(center_id,subject_id,created_at);
CREATE INDEX xq_activities_plot ON xq_activities(center_id,plot_id,occurred_at);
CREATE INDEX xq_activities_season ON xq_activities(season_id);
CREATE INDEX xq_orders_provider ON xq_work_orders(center_id,provider_subject_id,status);
CREATE INDEX xq_requests_plot ON xq_service_requests(center_id,plot_id);
CREATE INDEX xq_requests_market ON xq_service_requests(center_id,status,created_at);
CREATE INDEX xq_tickets_owner ON xq_help_tickets(center_id,account_id,identity_id,created_at);
CREATE INDEX xq_messages_account ON xq_messages(center_id,account_id,created_at);
CREATE INDEX xq_applications_account ON xq_identity_applications(center_id,account_id);
CREATE INDEX xq_cards_subject ON xq_cards(center_id,subject_id);
CREATE INDEX xq_news_public ON xq_news(center_id,status,published_at);
CREATE INDEX xq_audit_center ON xq_audit_logs(center_id,created_at);
CREATE INDEX xq_cost_season ON xq_cost_entries(center_id,season_id);
CREATE INDEX xq_payments_account ON xq_payment_orders(account_id);
CREATE INDEX xq_settlement_order ON xq_settlement_entries(payment_order_id);
