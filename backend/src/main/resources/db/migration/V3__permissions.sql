CREATE TABLE xq_role_permissions (
 role_id varchar(40) NOT NULL REFERENCES xq_roles(id), permission varchar(60) NOT NULL,
 PRIMARY KEY(role_id,permission)
);
