# Private Asset Setup Guide

This document describes how to configure and upload personalized, private assets for Naveena in MunchPick.

All custom images, textures, and video files are stored in private Supabase Storage buckets secured by Row Level Security (RLS). They are served dynamically via temporary signed URLs, keeping them secure from unauthorized access.

---

## 📁 Storage Bucket & Folder Structure

MunchPick utilizes three private storage buckets:
1. `user-videos` (for hero video loops)
2. `user-mascots` (for custom character illustrations)
3. `user-textures` (for customized page or envelope textures)

Inside each bucket, assets must be organized inside a folder named after the user's Supabase User ID (`user_id`).

### Structure Example:
```text
user-videos/
└── {user_id}/
    ├── hero-mobile.mp4
    └── hero-desktop.mp4

user-mascots/
└── {user_id}/
    ├── munch.png
    ├── coco.png
    ├── dobby.png
    ├── froggy.png
    ├── bubbles.png
    ├── ollie.png
    ├── chicky.png
    ├── pandy.png
    └── ellie.png

user-textures/
└── {user_id}/
    └── envelope-texture.png
```

---

## 🛠️ Step-by-Step Upload Workflow

No code changes are required after file uploads. Once files are in place, the application automatically recognizes and starts streaming them securely.

Follow these steps to upload assets:

### Step 1: Open the Supabase Dashboard
1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project space.

### Step 2: Navigate to Storage Buckets
1. In the left-hand navigation sidebar, click on **Storage** (the bucket icon).
2. Ensure the three buckets exist: `user-videos`, `user-mascots`, and `user-textures`. (If they do not exist, run the database migrations in `supabase/migrations/20260622003000_add_user_assets_table.sql` which provisions them automatically).

### Step 3: Identify the User ID
1. Navigate to the **Authentication** tab (user icon) in the Supabase Dashboard.
2. Under **Users**, locate the account of the user (Naveena) and copy their **User ID** (a long UUID string, e.g. `d3b07384-d113-4c4f-9c02-e25f1b621e25`).

### Step 4: Create User Folder & Upload Files
1. Go back to **Storage** and select the appropriate bucket (e.g. `user-videos`).
2. Click **Create Folder** and paste the **User ID** UUID copied in Step 3.
3. Open the newly created folder.
4. Click **Upload File** and select your local files:
   * **Videos** (in `user-videos/{user_id}/`): `hero-mobile.mp4`, `hero-desktop.mp4`
   * **Mascots** (in `user-mascots/{user_id}/`): `munch.png`, `ollie.png`, etc.
   * **Textures** (in `user-textures/{user_id}/`): `envelope-texture.png`

### Step 5: Optional Database Registry Override
By default, the signed URL service checks for files using the conventions above. If you want to use custom filenames or directory structures, you can insert a row in the `public.user_assets` table:
* Set `user_id` to the user's UUID.
* Set `hero_mobile_path`, `hero_desktop_path`, or `mascot_base_path` to your custom paths (e.g. `custom-folder/my-mobile.mp4`).

### Step 6: Verify Assets
1. Open the MunchPick web app and log in as the user.
2. Confirm the background video is streaming on the dashboard space.
3. Confirm that the mascot renders using your uploaded custom PNG illustrations.
4. Check browser developer console: no warnings regarding default experiences should be displayed if files loaded successfully.

---

## 🔒 Security & RLS Policies

All buckets are configured with **Public Access disabled**. Access is protected via Row Level Security (RLS) policies on the `storage.objects` table. These policies enforce:
* Only authenticated users can request or read objects.
* A user can only view or upload files inside their own `{user_id}/` directory path (`split_part(name, '/', 1) = auth.uid()::text`).
* Direct public storage paths will result in access denied errors.
