---
argument-hint: [title]
description: Create a new blog post in the feed
---

Create a new blog post with the following specifications:

**Title**: $REMAINING_ARGS (all arguments)

If no title is provided, prompt the user for a title interactively.

**Steps to create the blog post:**

1. Get the current date and time with `-07:00` timezone offset by running:

   ```bash
   TZ=America/Phoenix date +"%Y-%m-%d %H:%M:%S -07:00"
   ```

2. If no title was provided, ask the user: "What is the title for this blog post?"

3. Generate a slugified directory name from the title:

   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only alphanumeric and hyphens)
   - Example: "My Great Post!" → "my-great-post"

4. Create the directory at: `www/feed/<slugified-title>/`

5. Create the file at: `www/feed/<slugified-title>/index.md`

6. Populate the file with this frontmatter structure:

   ```yaml
   ---
   tags:
     - article
   layout: article
   author: eric
   title: <user-provided title>
   date: <datetime from step 1>
   teaser: >-
     <prompt user: "What is the teaser for this blog post?">
   ---
   ```

7. After the frontmatter, add a blank line and a comment:

   ```markdown
   <!-- Write your blog post content here -->
   ```

8. Open the newly created file in the editor for the user to start writing.

**Important notes:**

- Each blog post gets its own directory under `www/feed/`
- The main content file is always named `index.md`
- The date MUST include the full timestamp with time, not just the date
- Always use the `-07:00` timezone offset
- The default layout is `article` but can be changed later if needed (e.g., `video`)
- Additional frontmatter fields can be added later (e.g., `subhead`, `image`)
