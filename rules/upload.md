# File Upload & Object Storage — inline multipart + `@nestjs/storage`

Applies to every project with file uploads or object storage (NestJS APIs + web/portal/miniapp clients). Uploads ride inline `multipart/form-data` on authenticated business endpoints — never a standalone upload controller. Backend storage runs on `@nestjs/storage` (`StorageDisk`: `LocalDisk`, `S3Disk` for AWS S3/R2/MinIO, `InMemoryDisk` for tests).

> **Legacy note**: Repos not yet migrated to `@nestjs/storage` keep their single `StorageService` (`@aws-sdk/client-s3`) + `mediaUpload(fields, options)` interceptor until migrated in a dedicated PR.

## Client (web, portal, miniapp)

1. **Native axios multipart helpers** — Call `api.postForm<T>()` / `api.putForm<T>()` / `api.patchForm<T>()` with a typed payload mixing `File` and scalar fields; never hand-roll `toFormData`:

   ```ts
   const { data } = await api.postForm<MyVideo>('/trainers/me/videos', {
     title,
     thumbnail, // File — rides with the form submit
     tags,      // string[] — repeated per key
   });
   ```

2. **No eager upload & encapsulated preview cleanup** — Selected `File` objects travel with the form submit; never fire a pre-upload on file pick. Render previews through an encapsulated child component (`<PhotoThumbnail file={file} />`, `rules/frontend.md` #18) whose `useEffect` calls `URL.createObjectURL(file)` and revokes it on file change or unmount.
3. **Client pre-check is UX only** — Mirror the server's MIME/extension and size allowlist on the client for instant feedback; the server remains the security boundary.

## Server (`@nestjs/storage` + NestJS)

4. **One `StorageModule` per app, disks instead of SDK clients** — Register `StorageModule.forRoot()` / `forRootAsync()` once in `AppModule` (global). Services inject the default `StorageDisk`, a named `@InjectDisk('name')`, or `Storage`. Never instantiate `S3Client` in feature modules. Configure S3-compatible disks (`S3Disk`) with `region: 'auto'` (overridable via `S3_REGION`, default `auto`), `forcePathStyle: true`, and env-driven credentials (`S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).
   - **Provider-neutral naming**: disks are S3-compatible and may target AWS S3, MinIO, Cloudflare R2, or others. Use `S3_*` env vars and provider-neutral code symbols (`s3Base`, `storageBase`, `bucket`); never `R2_*` / `r2Base` / `cloudflare*`. Derive the storage base URL from `S3_ENDPOINT` + `S3_BUCKET_NAME` (or a single `S3_BASE_URL`) instead of hard-coding a provider name.
   - **Prefer `uploadToDisk` over `memoryStorage`**: use `uploadToDisk({ disk, contentTypes, limits, key })` so bytes stream straight to the disk with magic-byte validation and no full-body buffering. Reserve `memoryStorage()` for the rare case where the handler must transform the whole buffer in memory; even then, keep the body small and bound `limits.fileSize`.
5. **Inline multipart on authenticated business endpoints via `uploadToDisk`** — Attach `FileInterceptor` / `FileFieldsInterceptor` backed by `uploadToDisk({ disk, contentTypes, cacheControl })` (or the repo's `mediaUpload` interceptor) directly on the guarded business route (`@UseGuards(...)`):
   - **Magic-byte validation**: content type is detected from file bytes (`detectContentType`), paired with extension canonicalization (`EXT_TO_MIME` for ZIP-container formats like DOCX) and per-file size limits (default 10 MB → 413/400) before storage, leaving no partial files.
   - **Server-decided keys**: keys are generated server-side (`<folder>/<randomUUID()>.<ext>`); clients never control paths or filenames.
   - **No public `/uploads/*` endpoint**: uploads always ride an authenticated domain route. For exceptional direct-to-storage flows, use `signedUpload` + `receiveSignedUpload` + `detectContentType`.
6. **URL/key injection before `ValidationPipe`** — When using `mediaUpload(fields, options)` (`{ name, maxCount, folder?, bodyKey? }`), uploaded URLs inject into `req.body` before `ValidationPipe` so DTOs validate `@IsOptional() @IsUrl()` (`string`) or `@IsArray() @IsUrl({}, { each: true })` (`string[]`). Use `UploadFile` (local Multer subset interface) rather than global `Express.Multer.File`.
7. **Serving & private files** — Stream stored files via `serveFile(disk, file, { req, res, disposition })` (handles `Range` + `ETag`). Serve private files via time-limited `signedUrl` (and `serveSignedUrl` in dev).
8. **Swagger matches the wire format** — Decorate multipart handlers with `@ApiConsumes('multipart/form-data')` and `@ApiBody(multipartBody(fileFields, textFields))` so OpenAPI documents `format: binary` fields alongside text fields.
9. **Tests use `InMemoryDisk`** — Override `STORAGE_MODULE_OPTIONS` with `InMemoryDisk` instances and assert via `disk.keys()` / `disk.getBuffer(key)` — never touch the real filesystem or S3 in specs.

## Media lifecycle

10. **Create** — Upload via interceptor/disk and persist the resulting URL(s)/key(s) in the DB row.
11. **Replace (update): persist first, fire-and-forget GC second** — Update the DB row with the new URL(s)/key(s) **first**, then fire-and-forget deletion of dropped media (`void disk.delete(oldKey)` or `void this.storage.deleteDropped(oldUrls, keptUrls)`). Never `await` cleanup — a failed delete must never fail a committed business update.
12. **Entity delete** — Delete the DB row first, then fire-and-forget deletion of its media keys/URLs. Guard URL-to-key extraction so only objects on our storage host are deleted.
13. **Accept mid-update orphans** — If the upload succeeds but the subsequent DB write fails, leave the orphaned object in the bucket for batch GC; never add compensating deletes in error paths.
