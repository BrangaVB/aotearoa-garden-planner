-- RPC function for flushing offline SQLite sync_queue mutations to Supabase Postgres
create or replace function public.apply_garden_sync_batch(
  profile_id text,
  items jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  item jsonb;
  applied_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required for cloud sync';
  end if;

  for item in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb))
  loop
    if item->>'entity_type' = 'garden_zone' then
      if item->>'operation' = 'delete' then
        delete from public.garden_zones where id = item->>'entity_id' and profile_id = apply_garden_sync_batch.profile_id;
      else
        insert into public.garden_zones (
          id, profile_id, name, zone_type, width_cm, length_cm, sun_aspect, soil_type, drainage, rainwater_tank_connected, canvas_geometry
        )
        values (
          item->>'entity_id',
          apply_garden_sync_batch.profile_id,
          coalesce(item->'payload'->>'name', 'Garden Bed'),
          coalesce(item->'payload'->>'zoneType', 'Raised Bed'),
          coalesce((item->'payload'->>'widthCm')::double precision, 120),
          coalesce((item->'payload'->>'lengthCm')::double precision, 240),
          coalesce(item->'payload'->>'sunAspect', 'North'),
          coalesce(item->'payload'->>'soilType', 'Loam'),
          coalesce(item->'payload'->>'drainage', 'Moderate'),
          coalesce((item->'payload'->>'rainwaterTankConnected')::boolean, false),
          item->'payload'->'canvasGeometry'
        )
        on conflict (id) do update set
          name = excluded.name,
          zone_type = excluded.zone_type,
          width_cm = excluded.width_cm,
          length_cm = excluded.length_cm,
          sun_aspect = excluded.sun_aspect,
          soil_type = excluded.soil_type,
          drainage = excluded.drainage,
          rainwater_tank_connected = excluded.rainwater_tank_connected,
          canvas_geometry = excluded.canvas_geometry;
      end if;
      applied_count := applied_count + 1;
    elsif item->>'entity_type' = 'harvest_log' then
      insert into public.harvest_logs (
        id, profile_id, zone_id, species_id, harvested_date, quantity_grams, notes
      )
      values (
        item->>'entity_id',
        apply_garden_sync_batch.profile_id,
        item->'payload'->>'zoneId',
        item->'payload'->>'speciesId',
        coalesce((item->'payload'->>'harvestedDateIso')::date, current_date),
        coalesce((item->'payload'->>'quantityGrams')::integer, 0),
        item->'payload'->>'notes'
      )
      on conflict (id) do update set
        quantity_grams = excluded.quantity_grams,
        notes = excluded.notes;
      applied_count := applied_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'applied', applied_count,
    'synced_at', now()
  );
end;
$$;
