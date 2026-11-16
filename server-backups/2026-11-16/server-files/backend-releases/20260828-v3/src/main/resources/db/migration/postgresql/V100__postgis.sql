create extension if not exists postgis;
alter table plot add column if not exists geom geometry(MultiPolygon, 4326);
alter table resource_asset add column if not exists location geography(Point, 4326);
create index if not exists idx_plot_geom on plot using gist(geom);
create index if not exists idx_resource_location on resource_asset using gist(location);
