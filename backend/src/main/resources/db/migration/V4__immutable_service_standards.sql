CREATE TABLE xq_service_standards (
 id varchar(64) PRIMARY KEY, center_id varchar(64) NOT NULL REFERENCES xq_centers(id),
 operation varchar(80) NOT NULL, revision integer NOT NULL CHECK(revision>0),
 criteria varchar(2000) NOT NULL, published_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(center_id,id), UNIQUE(center_id,operation,revision)
);
ALTER TABLE xq_service_requests ADD COLUMN standard_id varchar(64);
ALTER TABLE xq_service_requests ADD FOREIGN KEY(center_id,standard_id) REFERENCES xq_service_standards(center_id,id);
CREATE INDEX xq_requests_standard ON xq_service_requests(center_id,standard_id);
CREATE INDEX xq_requests_subject ON xq_service_requests(center_id,subject_id);
CREATE INDEX xq_applications_role ON xq_identity_applications(role_id);
CREATE INDEX xq_sessions_identity_account ON xq_sessions(identity_id,account_id);
