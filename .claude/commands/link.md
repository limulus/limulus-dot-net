---
argument-hint: [url]
description: Create a new link blog post
---

Create a new link blog post with the following specifications:

**URL**: $REMAINING_ARGS (all arguments)

If no URL is provided, prompt the user for the URL interactively.

**Steps to create the link post:**

1. Get the current date and time with `-07:00` timezone offset by running:

   ```bash
   TZ=America/Phoenix date +"%Y-%m-%d %H:%M:%S -07:00"
   ```

2. If no URL was provided, ask the user: "What is the URL for this link?"

3. Fetch the linked page using `WebFetch` and extract the `<title>` tag content. This becomes the `linkTitle`. Clean up the title by trimming whitespace and removing any site name suffixes after common separators like ` | `, ` - `, ` — `, or ` · ` (only remove the last such segment if it looks like a site name, i.e., 3 words or fewer).

4. Ask the user: "Do you have a via URL?" (optional — the URL where you found the link, e.g., Hacker News, a blog, etc.)

5. Ask the user: "Do you have a blockquote to include?" (optional — a quote from the linked article to include in the post body)

6. Generate a slugified directory name from the `linkTitle`:

   - Aim for around 5 words maximum - remove filler words like "a", "the", "to", "for", "using", "how"
   - Focus on the core concepts and key terms
   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only alphanumeric and hyphens)
   - Examples:
     - "My Great Link!" → "my-great-link"
     - "The Future of Web Development" → "future-web-development"

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
    linkTitle: <fetched page title>
    date: <datetime from step 1>
    linkUrl: <user-provided URL>
    viaUrl: <user-provided via URL>
    ---
    ```

    Note: `layout` is provided by the data cascade in `www/links/links.json`
    and should NOT be included in the frontmatter.

    Note: Only include the `viaUrl` field if the user provided a via URL.

    Note: Do NOT include a `title` field — it will be computed automatically
    from `linkTitle` by the data cascade in `www/_data/eleventyComputed.js`.

11. After the frontmatter, add the post body:

    - If the user provided a blockquote, include it as a markdown blockquote (prefixed with `> `)
    - Add a blank line and a comment: `<!-- Write your commentary here -->`

12. Open the newly created file in VS Code by running:

    ```bash
    code www/links/YYYY/MM/DD/<slugified-title>/index.md
    ```

**Important notes:**

- Each link post gets its own directory under `www/links/YYYY/MM/DD/`
- The main content file is always named `index.md`
- The date MUST include the full timestamp with time, not just the date
- Always use the `-07:00` timezone offset
- Tags (`article` and `link`) MUST be included in the frontmatter
- Do NOT include `layout` in the frontmatter — it is provided by the data cascade in `www/links/links.json`
- Do NOT include `title` in the frontmatter — it is computed from `linkTitle` by `www/_data/eleventyComputed.js`
- The `linkUrl` field is required and should be a full URL (e.g., `https://example.com/article`)
- The `viaUrl` field is optional and should be a full URL if provided
