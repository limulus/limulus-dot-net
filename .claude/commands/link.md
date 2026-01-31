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

4. Ask the user: "Do you have a via URL?" (optional — the URL where you found the link, e.g., Hacker News, a blog, etc.)

5. Ask the user: "Do you have a blockquote to include?" (optional — a quote from the linked article to include in the post body)

6. Generate a slugified directory name from the title:

   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only alphanumeric and hyphens)
   - Example: "My Great Link!" → "my-great-link"

7. Extract the year, month, and day from the timestamp obtained in step 1
   (e.g., `2026-01-29 14:30:00 -07:00` → `2026/01/29`).

8. Create the directory at: `www/links/YYYY/MM/DD/<slugified-title>/`

9. Create the file at: `www/links/YYYY/MM/DD/<slugified-title>/index.md`

10. Populate the file with this frontmatter structure:

    ```yaml
    ---
    tags:
      - article
      - link
    author: eric
    title: <user-provided title>
    date: <datetime from step 1>
    linkUrl: <user-provided URL>
    viaUrl: <user-provided via URL>
    ---
    ```

    Note: `layout` is provided by the data cascade in `www/links/links.json`
    and should NOT be included in the frontmatter.

    Note: Only include the `viaUrl` field if the user provided a via URL.

11. After the frontmatter, add the post body:

    - If the user provided a blockquote, include it as a markdown blockquote (prefixed with `> `)
    - Add a blank line and a comment: `<!-- Write your commentary here -->`

12. Open the newly created file in the editor for the user to start writing.

**Important notes:**

- Each link post gets its own directory under `www/links/YYYY/MM/DD/`
- The main content file is always named `index.md`
- The date MUST include the full timestamp with time, not just the date
- Always use the `-07:00` timezone offset
- Tags (`article` and `link`) MUST be included in the frontmatter
- Do NOT include `layout` in the frontmatter — it is provided by the data cascade in `www/links/links.json`
- The `linkUrl` field is required and should be a full URL (e.g., `https://example.com/article`)
- The `viaUrl` field is optional and should be a full URL if provided
