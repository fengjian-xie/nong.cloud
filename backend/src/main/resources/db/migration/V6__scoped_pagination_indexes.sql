-- Stable pagination uses a unique id tie-breaker; support center-wide and owner queues.
CREATE INDEX xq_plots_center_page ON xq_plots(center_id,created_at DESC,id);
CREATE INDEX xq_activities_center_page ON xq_activities(center_id,created_at DESC,id);
CREATE INDEX xq_requests_owner_page ON xq_service_requests(center_id,subject_id,created_at DESC,id);
CREATE INDEX xq_orders_provider_page ON xq_work_orders(center_id,provider_subject_id,created_at DESC,id);
CREATE INDEX xq_tickets_center_page ON xq_help_tickets(center_id,created_at DESC,id);
CREATE INDEX xq_applications_center_page ON xq_identity_applications(center_id,created_at DESC,id);
CREATE INDEX xq_news_admin_page ON xq_news(center_id,created_at DESC,id);
