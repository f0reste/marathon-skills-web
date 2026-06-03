const DEFAULT_BUCKET = "participant-photos";

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
    bucket
  };
}

function isRemoteUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function safePathPart(value) {
  return String(value || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

function photoDataUrlToBuffer(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|bmp));base64,([a-z0-9+/=]+)$/i.exec(dataUrl || "");
  if (!match) {
    throw new Error("Unsupported photo format.");
  }

  return {
    contentType: match[1] === "image/bmp" ? "image/jpeg" : match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

export async function uploadParticipantPhoto(photo, userId) {
  if (!photo?.dataUrl) return null;
  if (isRemoteUrl(photo.dataUrl)) return photo;

  const config = getStorageConfig();
  if (!config) {
    throw new Error("Supabase Storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }

  const { buffer, contentType } = photoDataUrlToBuffer(photo.dataUrl);
  const userFolder = safePathPart(userId);
  const fileName = safePathPart(photo.name || "participant-photo.jpg").replace(/\.(png|bmp)$/i, ".jpg");
  const objectPath = `${userFolder}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: buffer
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase Storage upload failed: ${response.status} ${details}`);
  }

  return {
    name: fileName,
    dataUrl: `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${objectPath}`,
    width: photo.width || 512,
    height: photo.height || 512
  };
}
