create or replace function public.preserve_catalog_presentation_image()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.image_url is not null or old.image_path is not null)
     and new.image_url is null and new.image_path is null then
    new.image_url := old.image_url;
    new.image_path := old.image_path;
  end if;
  return new;
end;
$$;
