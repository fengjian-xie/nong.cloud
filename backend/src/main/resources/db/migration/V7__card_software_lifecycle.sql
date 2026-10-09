ALTER TABLE xq_cards ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE xq_cards ADD COLUMN software_only boolean NOT NULL DEFAULT false;
CREATE TABLE xq_card_requests (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL, subject_id varchar(64) NOT NULL,
 account_id varchar(64) NOT NULL REFERENCES xq_accounts(id), identity_id varchar(64) NOT NULL REFERENCES xq_identities(id),
 kind varchar(20) NOT NULL CHECK(kind IN ('issue','replacement')),
 old_card_id varchar(64), old_binding_version integer, new_card_id varchar(64),
 reason varchar(2000) NOT NULL, fee_fen integer NOT NULL DEFAULT 10000 CHECK(fee_fen=10000),
 status varchar(24) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','cloud_registered')),
 review_note varchar(2000), reviewer_id varchar(64) REFERENCES xq_accounts(id),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id),
 FOREIGN KEY(center_id,old_card_id) REFERENCES xq_cards(center_id,id),
 FOREIGN KEY(center_id,new_card_id) REFERENCES xq_cards(center_id,id),
 CHECK((kind='issue' AND old_card_id IS NULL AND old_binding_version IS NULL) OR (kind='replacement' AND old_card_id IS NOT NULL AND old_binding_version>0)),
 CHECK((status='cloud_registered')=(new_card_id IS NOT NULL))
);
CREATE UNIQUE INDEX xq_card_replacement_pending ON xq_card_requests(old_card_id) WHERE kind='replacement' AND status IN ('pending','approved');
CREATE INDEX xq_card_requests_owner ON xq_card_requests(center_id,account_id,identity_id,created_at DESC,id);
CREATE INDEX xq_card_requests_center ON xq_card_requests(center_id,created_at DESC,id);
CREATE INDEX xq_card_requests_subject ON xq_card_requests(center_id,subject_id);
CREATE INDEX xq_card_requests_new ON xq_card_requests(new_card_id);
CREATE INDEX xq_card_requests_reviewer ON xq_card_requests(reviewer_id);
CREATE TABLE xq_card_binding_history (
 card_id varchar(64) NOT NULL, binding_version integer NOT NULL CHECK(binding_version>0),
 center_id varchar(64) NOT NULL, subject_id varchar(64) NOT NULL, status varchar(20) NOT NULL,
 action varchar(40) NOT NULL, reason varchar(2000) NOT NULL, actor_id varchar(64) REFERENCES xq_accounts(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(card_id,binding_version),
 FOREIGN KEY(center_id,card_id) REFERENCES xq_cards(center_id,id),
 FOREIGN KEY(center_id,subject_id) REFERENCES xq_subjects(center_id,id), CHECK(status IN ('active','lost','retired'))
);
CREATE INDEX xq_card_binding_subject ON xq_card_binding_history(center_id,subject_id);
CREATE INDEX xq_card_binding_actor ON xq_card_binding_history(actor_id);
INSERT INTO xq_card_binding_history(card_id,binding_version,center_id,subject_id,status,action,reason)
 SELECT id,binding_version,center_id,subject_id,status,'legacy_snapshot','既有云端绑定快照；首次绑定时间及实物状态未验证' FROM xq_cards;
CREATE TRIGGER xq_card_binding_immutable BEFORE UPDATE OR DELETE ON xq_card_binding_history FOR EACH ROW EXECUTE FUNCTION xq_reject_evidence_mutation();
CREATE INDEX xq_device_events_page ON xq_device_events(card_id,received_at DESC,event_id);
INSERT INTO xq_role_permissions(role_id,permission)
 SELECT r.id,p.permission FROM xq_roles r CROSS JOIN (VALUES('cards.request'),('cards.loss'),('cards.upload')) p(permission)
 WHERE r.id IN ('farmer','cooperative') ON CONFLICT DO NOTHING;
