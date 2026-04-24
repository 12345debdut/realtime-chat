# Walkthrough videos

Two end-to-end demonstrations referenced from the main `README.md`. Thumbnails live here; the actual MP4s are hosted on GitHub's user-attachments CDN (drag-and-dropped into any issue/comment/release on this repo — see [How to upload](#how-to-upload) below).

## Files in this directory

| File       | What it is                                                                           |
| ---------- | ------------------------------------------------------------------------------------ |
| `full.jpg` | Thumbnail for `full_views.mp4` — extracted frame at ~01:00. Full walkthrough ≈ 3:32. |
| `chat.jpg` | Thumbnail for `chat_views.mp4` — extracted frame at ~00:25. Chat walkthrough ≈ 1:16. |

Thumbnails are committed to the repo; videos are not (they live on GitHub's CDN to avoid bloating every clone).

## How to upload

GitHub's user-attachments feature gives you a stable, CDN-hosted URL for any file dropped into an issue or comment. Steps:

1. Go to <https://github.com/12345debdut/realtime-chat/issues/new> (any issue — you'll close it without submitting).
2. Drag `full_views_compressed.mp4` into the comment text box. GitHub uploads and rewrites the markdown as something like:

   ```
   https://github.com/user-attachments/assets/8f3a…
   ```

3. Copy that URL.
4. Repeat for `chat_views.mp4`.
5. **Close the issue without submitting** — the uploads persist regardless.
6. Paste both URLs into `README.md`'s `## Walkthroughs` section where you see `{{FULL_VIDEO_URL}}` and `{{CHAT_VIDEO_URL}}` placeholders.
7. Commit the README change; push.

The `user-attachments` URLs are permanent as long as the repo exists. They survive repo transfers and are served from GitHub's own CDN.

## Compression + thumbnail workflow

If you re-record either walkthrough, repeat these two steps before uploading:

```sh
# Compress the source to fit under GitHub's 100 MB user-attachments limit
# (and downscale 4K screen captures to 1080p while we're at it).
ffmpeg -i full_views.mp4 \
  -vf scale=1920:-2 -c:v libx264 -preset slow -crf 24 \
  -c:a aac -b:a 96k -movflags +faststart \
  full_views_compressed.mp4

# Grab a thumbnail — pick a timestamp mid-action, not the opening frame.
ffmpeg -ss 60 -i full_views.mp4 \
  -frames:v 1 -q:v 3 -vf scale=1280:-2 \
  docs/walkthroughs/full.jpg
```

Use the same `ffmpeg` pipeline for the chat walkthrough too — **even if it's already under 100 MB.** Screen recordings often come out with odd dimensions (e.g. `3548×2660`) or a QuickTime-inside-`.mp4` container that GitHub's upload validator rejects. Re-encoding normalizes both and almost always shrinks the file dramatically (our chat clip went 25 MB → 0.8 MB with no visible quality loss).

## Why not commit the videos?

A 50-100 MB MP4 checked into git adds to every single clone forever. For a repo where people run `yarn install` then iterate, that's dead weight for 99% of interactions. GitHub's CDN exists for exactly this case.
