import java.sql.*;

/** Development bootstrap only: no remote host, no superuser application account. */
class LocalDatabaseSetup {
    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(args.length == 0 ? "55439" : args[0]);
        try (Connection c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:"+port+"/postgres","postgres",""); Statement s=c.createStatement()) {
            s.execute("CREATE ROLE xq_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE");
            s.execute("CREATE ROLE xq_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE");
            s.execute("CREATE DATABASE xiangqiao_local OWNER xq_migrator");
        }
        try (Connection c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:"+port+"/xiangqiao_local","xq_migrator",""); Statement s=c.createStatement()) {
            s.execute("GRANT USAGE ON SCHEMA public TO xq_app");
            s.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO xq_app");
            s.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO xq_app");
        }
        System.out.println("LOCAL_DATABASE_READY");
    }
}
