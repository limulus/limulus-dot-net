---
argument-hint: [title]
description: Create a new link blog post
---

Create a new link blog post with the following specifications:

**Title**: $REMAINING_ARGS (all arguments)

If no title is provided, prompt the user for a title interactively.

**Steps to create the link post:**

1. Get the current date and time with `-07:00` timezone offset by running:

   ```bash
   TZ=America/Phoenix date +"%Y-%m-%d %H:%M:%S -07:00"
   ```

2. If no title was provided, ask the user: "What is the title for this link post?"

3. Ask the user: "What is the URL for this link?"

4. Ask the user: "What is the teaser/commentary for this link?"

5. Generate a slugified directory name from the title:

   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only alphanumeric and hyphens)
   - Example: "My Great Link!" → "my-great-link"

6. Create the directory at: `www/links/<slugified-title>/`

7. Create the file at: `www/links/<slugified-title>/index.md`

8. Populate the file with this frontmatter structure:

   ```yaml
   ---
   tags:
     - article
     - link
   author: eric
   title: <user-provided title>
   date: <datetime from step 1>
   linkUrl: <user-provided URL>
   teaser: >-
     <user-provided teaser>
   ---
   ```

   Note: `layout` is provided by the data cascade in `www/links/links.json`
   and should NOT be included in the frontmatter.

9. After the frontmatter, add a blank line and a comment:

   ```markdown
   <!-- Write your commentary here -->
   ```

10. Open the newly created file in the editor for the user to start writing.

**Important notes:**

- Each link post gets its own directory under `www/links/`
- The main content file is always named `index.md`
- The date MUST include the full timestamp with time, not just the date
- Always use the `-07:00` timezone offset
- Tags (`article` and `link`) MUST be included in the frontmatter
- Do NOT include `layout` in the frontmatter — it is provided by the data cascade in `www/links/links.json`
- The `linkUrl` field is required and should be a full URL (e.g., `https://example.com/article`)
