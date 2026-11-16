create table county_space (
    code varchar(32) primary key,
    name varchar(100) not null,
    province varchar(100) not null,
    city varchar(100) not null,
    status varchar(20) not null default 'ACTIVE',
    created_at timestamp with time zone not null default current_timestamp
);

create table user_account (
    id uuid primary key,
    mobile_hash varchar(64) not null unique,
    mobile_ciphertext varchar(512) not null,
    display_name varchar(100) not null,
    password_hash varchar(100) not null,
    status varchar(20) not null default 'ACTIVE',
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table county_membership (
    id uuid primary key,
    county_code varchar(32) not null references county_space(code),
    user_id uuid not null references user_account(id),
    identity_type varchar(40) not null,
    role_code varchar(40) not null,
    certification_status varchar(30) not null default 'PENDING',
    organization_name varchar(200),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    unique(county_code, user_id, identity_type)
);
create index idx_membership_user_county on county_membership(user_id, county_code);

create table plot (
    id uuid primary key,
    county_code varchar(32) not null,
    owner_user_id uuid not null,
    name varchar(200) not null,
    town varchar(100) not null,
    village varchar(100),
    area_mu decimal(14,2) not null,
    crop_category varchar(100),
    crop_variety varchar(100),
    maturity_status varchar(30) not null default 'GROWING',
    harvest_start date,
    harvest_end date,
    geojson text,
    longitude decimal(10,7),
    latitude decimal(10,7),
    address_level varchar(30) not null default 'NEARBY_ONLY',
    last_verified_at timestamp with time zone not null,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_plot_search on plot(county_code, town, crop_variety, maturity_status, last_verified_at);

create table farm_activity (
    id uuid primary key,
    county_code varchar(32) not null,
    plot_id uuid not null references plot(id),
    activity_type varchar(60) not null,
    occurred_at timestamp with time zone not null,
    area_mu decimal(14,2),
    executor_name varchar(100),
    equipment varchar(200),
    input_name varchar(200),
    input_amount varchar(100),
    details_json text,
    source_type varchar(30) not null,
    source_id varchar(100),
    client_serial varchar(100) not null,
    ai_confirmed boolean not null default false,
    created_by uuid not null,
    created_at timestamp with time zone not null,
    unique(county_code, client_serial)
);
create index idx_activity_plot_time on farm_activity(county_code, plot_id, occurred_at);

create table resource_asset (
    id uuid primary key,
    county_code varchar(32) not null,
    owner_user_id uuid not null,
    resource_type varchar(50) not null,
    name varchar(200) not null,
    town varchar(100) not null,
    capacity_value decimal(14,2),
    capacity_unit varchar(30),
    price_amount decimal(14,2),
    price_unit varchar(30),
    longitude decimal(10,7),
    latitude decimal(10,7),
    address_text varchar(500),
    address_level varchar(30) not null default 'PUBLIC',
    attributes_json text,
    certification_status varchar(30) not null default 'PENDING',
    availability_status varchar(30) not null default 'AVAILABLE',
    last_verified_at timestamp with time zone not null,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_resource_search on resource_asset(county_code, resource_type, town, availability_status, last_verified_at);

create table service_request (
    id uuid primary key,
    county_code varchar(32) not null,
    requester_user_id uuid not null,
    plot_id uuid references plot(id),
    service_type varchar(60) not null,
    area_mu decimal(14,2),
    expected_start timestamp with time zone,
    expected_end timestamp with time zone,
    budget_amount decimal(14,2),
    description varchar(1000),
    status varchar(30) not null,
    last_verified_at timestamp with time zone not null,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_service_request on service_request(county_code, service_type, status, last_verified_at);

create table quote (
    id uuid primary key,
    county_code varchar(32) not null,
    service_request_id uuid not null references service_request(id),
    provider_user_id uuid not null,
    amount decimal(14,2) not null,
    description varchar(1000),
    status varchar(30) not null,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table work_order (
    id uuid primary key,
    county_code varchar(32) not null,
    service_request_id uuid not null references service_request(id),
    quote_id uuid not null references quote(id),
    requester_user_id uuid not null,
    provider_user_id uuid not null,
    amount decimal(14,2) not null,
    status varchar(30) not null,
    checked_in_at timestamp with time zone,
    completed_at timestamp with time zone,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_work_order_party on work_order(county_code, requester_user_id, provider_user_id, status);

create table supply_listing (
    id uuid primary key,
    county_code varchar(32) not null,
    seller_user_id uuid not null,
    plot_id uuid references plot(id),
    product_name varchar(150) not null,
    variety varchar(100),
    town varchar(100) not null,
    area_mu decimal(14,2),
    maturity_status varchar(30) not null,
    harvest_start date,
    harvest_end date,
    quantity decimal(14,2) not null,
    unit varchar(30) not null,
    grade varchar(50),
    price_amount decimal(14,2),
    status varchar(30) not null default 'PENDING_REVIEW',
    last_verified_at timestamp with time zone not null,
    attributes_json text,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_supply_search on supply_listing(county_code, town, variety, maturity_status, last_verified_at);

create table purchase_request (
    id uuid primary key,
    county_code varchar(32) not null,
    buyer_user_id uuid not null,
    product_name varchar(150) not null,
    variety varchar(100),
    target_town varchar(100),
    maturity_status varchar(30),
    expected_date date,
    quantity decimal(14,2) not null,
    unit varchar(30) not null,
    package_requirement varchar(300),
    delivery_method varchar(100),
    quality_requirement varchar(500),
    status varchar(30) not null default 'PENDING_REVIEW',
    last_verified_at timestamp with time zone not null,
    version bigint not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_purchase_search on purchase_request(county_code, product_name, variety, status, last_verified_at);

create table field_template (
    id uuid primary key,
    county_code varchar(32) not null,
    target_type varchar(50) not null,
    category_code varchar(100),
    version integer not null,
    name varchar(150) not null,
    definition_json text not null,
    status varchar(20) not null default 'ACTIVE',
    created_by uuid not null,
    created_at timestamp with time zone not null,
    unique(county_code,target_type,category_code,version)
);

create table payment_order (
    id uuid primary key,
    county_code varchar(32) not null,
    business_type varchar(40) not null,
    business_id uuid not null,
    amount decimal(14,2) not null,
    fee_rule_snapshot text not null,
    merchant_route varchar(100),
    provider_trade_no varchar(100),
    status varchar(30) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_payment_business on payment_order(county_code, business_type, business_id);

create table call_ticket (
    id uuid primary key,
    county_code varchar(32) not null,
    caller_user_id uuid not null,
    contact_type varchar(40) not null,
    contact_id uuid not null,
    payment_order_id uuid,
    fee_amount decimal(14,2) not null default 1.00,
    status varchar(30) not null,
    provider_binding_id varchar(100),
    expires_at timestamp with time zone,
    connected_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table integration_job (
    id uuid primary key,
    county_code varchar(32) not null,
    provider varchar(50) not null,
    job_type varchar(50) not null,
    subject_type varchar(50) not null,
    subject_id uuid not null,
    status varchar(30) not null,
    request_json text,
    response_json text,
    attempt_count integer not null default 0,
    next_attempt_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_integration_retry on integration_job(county_code, provider, status, next_attempt_at);

create table webhook_event (
    id uuid primary key,
    provider varchar(50) not null,
    provider_event_id varchar(150) not null,
    county_code varchar(32),
    payload text not null,
    processed_at timestamp with time zone,
    created_at timestamp with time zone not null,
    unique(provider, provider_event_id)
);

create table audit_log (
    id uuid primary key,
    county_code varchar(32),
    actor_user_id uuid,
    action varchar(80) not null,
    resource_type varchar(80) not null,
    resource_id varchar(100),
    outcome varchar(30) not null,
    ip_address varchar(80),
    details_json text,
    created_at timestamp with time zone not null
);
create index idx_audit_county_time on audit_log(county_code, created_at);

create table outbox_event (
    id uuid primary key,
    county_code varchar(32),
    aggregate_type varchar(80) not null,
    aggregate_id varchar(100) not null,
    event_type varchar(100) not null,
    payload text not null,
    status varchar(20) not null default 'PENDING',
    created_at timestamp with time zone not null,
    published_at timestamp with time zone
);
create index idx_outbox_pending on outbox_event(status, created_at);

insert into county_space(code, name, province, city) values
('350981', '福安市', '福建省', '宁德市');
