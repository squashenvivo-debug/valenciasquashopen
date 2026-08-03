-- PSA Valencia — Phase 2: allow original camera files uploaded with TUS.
-- Images are stored in Supabase Storage, never in the Git repository.

update storage.buckets
set file_size_limit = 104857600
where id in ('photos', 'processed');
