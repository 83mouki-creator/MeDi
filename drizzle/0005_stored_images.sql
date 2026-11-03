-- Photos téléversées conservées dans la base.
--
-- Sur un hébergement sans disque persistant (Vercel), un fichier écrit dans
-- `public/uploads` disparaît au déploiement suivant. Cette table garde l'image
-- WebP normalisée et son empreinte, pour qu'une fiche produit ne perde jamais
-- sa photo. La route `/media/[id]` sert le contenu avec un cache long.

CREATE TABLE IF NOT EXISTS "stored_images" (
  "id" text PRIMARY KEY NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text DEFAULT 'image/webp' NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "bytes" integer NOT NULL,
  "checksum" text NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "stored_images_checksum_key" ON "stored_images" ("checksum");
