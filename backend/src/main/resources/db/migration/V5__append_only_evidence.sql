-- Corrections must use new versions, not overwrite original evidence/audit history.
CREATE FUNCTION xq_reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'immutable evidence: append a new version instead';
END;
$$;
CREATE TRIGGER xq_activities_immutable BEFORE UPDATE OR DELETE ON xq_activities FOR EACH ROW EXECUTE FUNCTION xq_reject_evidence_mutation();
CREATE TRIGGER xq_events_immutable BEFORE UPDATE OR DELETE ON xq_device_events FOR EACH ROW EXECUTE FUNCTION xq_reject_evidence_mutation();
CREATE TRIGGER xq_config_history_immutable BEFORE UPDATE OR DELETE ON xq_card_configurations FOR EACH ROW EXECUTE FUNCTION xq_reject_evidence_mutation();
CREATE TRIGGER xq_standards_immutable BEFORE UPDATE OR DELETE ON xq_service_standards FOR EACH ROW EXECUTE FUNCTION xq_reject_evidence_mutation();
CREATE TRIGGER xq_audit_immutable BEFORE UPDATE OR DELETE ON xq_audit_logs FOR EACH ROW EXECUTE FUNCTION xq_reject_evidence_mutation();
