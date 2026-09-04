# File Upload & Object Storage — inline multipart + S3-compatible

Applies to every project with file uploads (NestJS APIs + web clients). File uploads are inline `multipart/form-data` on business endpoints — there is no dedicated upload service. Object storage is S3-compatible (AWS S3, Cloudflare R2, MinIO) via `@aws-sdk/client-s3`.

## Client (web/portal/miniapp)

1. **Native axios multipart helpers** — `api.postForm<T>()` / `api.putForm<T>()` / `api.patchForm<T>()` with the generic type parameter; never a hand-rolled `toFormData` helper. The body is a typed object mixing `File` and scalar fields:

   ```ts
   const { data } = await api.postForm<MyVideo>('/trainers/me/videos', {
     title,
     thumbnail,        // File — rides with the submit
     tags,             // string[] — repeated per key
   })
   ```

2. **No eager upload** — the selected `File` travels with the form submit. There is no upload endpoint to pre-upload to; a component that fires an upload on pick is building a dead round-trip. Preview via `URL.createObjectURL`, revoke on clear or component unmount. Multi-file preview grids encapsulate the URL lifecycle in a child thumbnail component (`PhotoThumbnail`) so each blob URL is revoked automatically on thumbnail removal or form unmount (never allocate `URL.createObjectURL` during render).
3. **Client pre-check mirrors the server allowlist** (type + size) for UX only — the server is the trust boundary; the client check is never the security decision.

## Server (NestJS)

4. **One storage service** — all S3 access lives in a single `StorageService` (`infra/storage/`): `upload(buffer, filename, mimetype, folder)` → object key, `publicUrlFor(key)`, `presignedGet`/`presignPut` (for exceptional direct access), and best-effort `deleteUrls`/`deleteDropped`. No module reaches for `S3Client` directly.
5. **One interceptor factory, no upload controller** — endpoints use a single `mediaUpload(fields, options)` interceptor that parses, validates, uploads, and injects URLs. No `POST /uploads/*` endpoints, no presign-then-PUT client flows, no services calling `storage.upload` directly (storage awareness must not leak into services).
6. **Validation lives in the interceptor, not the service** — per-field `maxCount`, per-file size cap (default 10MB → 413 via multer `limits`), extension-derived MIME canonicalization (`EXT_TO_MIME`; DOCX shares the ZIP signature, so extension is the only reliable signal), plus the declared-mimetype allowlist. Reject with `BadRequestException` before anything is stored.
7. **URLs inject into `req.body` before the ValidationPipe** — DTOs and services keep their URL-shaped contract. Single-file fields become `string`, `maxCount > 1` fields become `string[]`; an absent field stays absent so `@IsOptional()` still applies. The DTO validates the injected URLs, never the raw files.
8. **Keys are server-decided** — `buildKey(folder, filename)` = sanitized server-side folder + `randomUUID()` + sanitized, lowercased, length-capped extension. Clients never supply paths or folders; the folder comes from the field config.
9. **Deletes are best-effort and never throw** — replacing media calls `deleteUrls(old)`/`deleteDropped(old, kept)`; a failed GC must not fail the update. Orphaned objects left by failed mid-update writes are GC'd by callers (a full GC job if storage costs ever matter).
10. **Endpoints are authenticated** — uploads ride business endpoints that carry guards. A public `/uploads/*` endpoint is a violation.
11. **Swagger matches the wire format** — `@ApiConsumes('multipart/form-data')` + a shared `multipartBody(fileFields, textFields)` helper; the docs show `format: binary` file fields plus the required text fields.
12. **S3-compatible client config** — `region: 'auto'`, `forcePathStyle: true`, endpoint/bucket/credentials from env (`S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). Bucket existence is ensured best-effort at startup and never blocks boot.
13. **UploadFile shape is local** — a local `UploadFile` interface (Multer `File` subset) instead of the global `Express.Multer.File` augmentation, which is fragile across TS configs.

## Handler patterns (backend)

14. **One `mediaUpload` call per multipart endpoint** — the field config is the endpoint contract: `{ name, maxCount, folder?, bodyKey? }`. Multi-field endpoints pass an array; `folder` is a server-decided storage path (`'articles'`, `'vendor/legal'`, `'court-photos'`); `bodyKey` renames the injected body field when the DTO expects a different key than the form field (e.g. `{ name: 'photo', bodyKey: 'url' }`):

   ```ts
   @Post(':id')
   @UseGuards(RolesGuard)
   @UseInterceptors(mediaUpload([
     { name: 'coverImage', maxCount: 1, folder: 'articles' },
     { name: 'attachments', maxCount: 5, bodyKey: 'attachmentUrls' },
   ]))
   @ApiConsumes('multipart/form-data')
   @ApiBody(multipartBody(
     [{ name: 'coverImage' }, { name: 'attachments' }],
     [{ name: 'title', required: true }],
   ))
   update(@Param('id') id: string, @Body() dto: UpdateArticleDto) { /* dto.attachmentUrls: string[] */ }
   ```

15. **DTOs declare the injected URLs** — a single-file field is `@IsOptional() @IsUrl()` `string`, a multi-file field is `@IsOptional() @IsArray() @IsUrl({}, { each: true })` `string[]`. The DTO never sees a `File`; validation runs after the interceptor injected the URLs.

## Media lifecycle

16. **Create** — the interceptor uploads and injects; the service persists the URL(s). Nothing to delete.
17. **Replace (update)** — persist the new URL(s) **first**, then fire-and-forget the drop: `void this.storage.deleteDropped([existing.coverImage], [dto.coverImage])`. Never `await` it — a failed GC must not fail the update; `deleteDropped` filters `old` to the URLs absent from `kept` (`?? []` on both sides).
18. **Entity delete** — delete the row, then `void this.storage.deleteUrls(entity.photos)`.
19. **Only the storage host's URLs are ever deleted** — `deleteUrls` extracts keys from URLs and skips invalid ones; stale-host URLs are guarded via `isStaleUrl`. Never hand-roll key extraction from a URL.
20. **Failure mid-update leaves orphaned objects — accepted** — the new upload succeeded but the persist failed: the object sits in the bucket until a GC job (added if storage costs ever matter). Do not add compensating deletes in error paths; that is the anti-pattern, not the fix.
