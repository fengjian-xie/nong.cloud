-- Withdrawal is a software state change, never a refund or payment receipt.
ALTER TABLE xq_memberships
 ADD COLUMN cancellation_note varchar(2000),
 ADD COLUMN cancelled_at timestamptz,
 ADD COLUMN cancelled_by varchar(64) REFERENCES xq_accounts(id);
ALTER TABLE xq_service_requests
 ADD COLUMN cancellation_note varchar(2000),
 ADD COLUMN cancelled_at timestamptz,
 ADD COLUMN cancelled_by varchar(64) REFERENCES xq_accounts(id);
-- Keep any historical cancelled rows intact; all new cancellations must carry evidence.
ALTER TABLE xq_memberships ADD CONSTRAINT xq_membership_cancel_evidence
 CHECK(status<>'cancelled' OR (length(trim(cancellation_note))>0 AND cancellation_note IS NOT NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)) NOT VALID;
ALTER TABLE xq_service_requests ADD CONSTRAINT xq_service_cancel_evidence
 CHECK(status<>'cancelled' OR (length(trim(cancellation_note))>0 AND cancellation_note IS NOT NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)) NOT VALID;
CREATE INDEX xq_membership_cancel_actor ON xq_memberships(cancelled_by) WHERE cancelled_by IS NOT NULL;
CREATE INDEX xq_service_cancel_actor ON xq_service_requests(cancelled_by) WHERE cancelled_by IS NOT NULL;
