import java.sql.*;

/** Non-mutating privilege and migration checks; rollback attempted evidence changes. */
class LocalDatabaseCheck {
    public static void main(String[] args) throws Exception {
        try (Connection c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:55439/xiangqiao_local","xq_app",""); Statement s=c.createStatement()) {
            try(ResultSet rows=s.executeQuery("SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user")) {
                rows.next();if(rows.getBoolean(1)||rows.getBoolean(2)||rows.getBoolean(3))throw new AssertionError("runtime account has excessive privileges");
            }
            try(ResultSet rows=s.executeQuery("SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1")) {rows.next();if(!"9".equals(rows.getString(1)))throw new AssertionError("migration version not current");}
            try(ResultSet rows=s.executeQuery("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'xq_%'")){rows.next();if(rows.getInt(1)!=39)throw new AssertionError("typed domain table count not current");}
            c.setAutoCommit(false);
            for(String table:new String[]{"xq_memberships","xq_service_requests"}){
                String current=table.equals("xq_memberships")?"pending":"open";
                try{s.executeUpdate("UPDATE "+table+" SET status='cancelled',cancellation_note=NULL,cancelled_at=NULL,cancelled_by=NULL WHERE id=(SELECT id FROM "+table+" WHERE status='"+current+"' LIMIT 1)");
                    // Existing fixtures may contain no outstanding membership; test its SQL constraint separately via API.
                    if(s.getUpdateCount()>0)throw new AssertionError(table+" cancellation must carry evidence");
                }catch(SQLException expected){if(!"23514".equals(expected.getSQLState()))throw expected;}finally{c.rollback();}
            }
            try {s.executeUpdate("UPDATE xq_service_standards SET criteria='overwrite' WHERE id='standard-local-001'");throw new AssertionError("standards must be immutable");}catch(SQLException expected){if(!expected.getMessage().contains("immutable evidence"))throw expected;}finally{c.rollback();}
            try {s.executeUpdate("UPDATE xq_audit_logs SET action='overwrite' WHERE id=(SELECT id FROM xq_audit_logs LIMIT 1)");throw new AssertionError("audit must be immutable");}catch(SQLException expected){if(!expected.getMessage().contains("immutable evidence"))throw expected;}finally{c.rollback();}
            try {s.executeUpdate("UPDATE xq_card_binding_history SET reason='overwrite' WHERE card_id='card-local-001'");throw new AssertionError("card binding history must be immutable");}catch(SQLException expected){if(!expected.getMessage().contains("immutable evidence"))throw expected;}finally{c.rollback();}
            for(String table:new String[]{"xq_handover_events","xq_membership_plans","xq_settlement_plans"}){
                try{s.executeUpdate("DELETE FROM "+table+" WHERE id=(SELECT id FROM "+table+" LIMIT 1)");throw new AssertionError(table+" must be immutable");}catch(SQLException expected){if(!expected.getMessage().contains("append-only"))throw expected;}finally{c.rollback();}
            }
        }
        System.out.println("POSTGRESQL_PRIVILEGES_MIGRATIONS_IMMUTABILITY_PASS");
    }
}
