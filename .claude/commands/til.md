---
argument-hint: <topic> [title]
description: Create a new Today I Learned (TIL) article
---

Create a new TIL article with the following specifications:

**Topic**: $1 (first argument - required, can be kebab-case like "my-topic")
**Title**: $REMAINING_ARGS (everything after the first argument)

If no title is provided after the topic, prompt the user for a title interactively.

**Steps to create the TIL:**

1. Get the current date and time with `-07:00` timezone offset by running:
   ```bash
   TZ=America/Phoenix date +"%Y-%m-%d %H:%M:%S -07:00"
   ```

2. If no title was provided, ask the user: "What is the title for this TIL?"

3. Generate a slugified filename from the title:
   - Aim for around 5 words maximum - remove filler words like "a", "the", "to", "for", "using", "how"
   - Focus on the core concepts and key terms
   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only alphanumeric and hyphens)
   - Examples:
     - "My Great TIL!" → "my-great-til"
     - "Using TypeScript Generic Constraints" → "typescript-generic-constraints"

4. Create the file at: `www/tils/$1/<slugified-title>.md`

5. Populate the file with this frontmatter structure:
   ```yaml
   ---
   title: <user-provided title>
   layout: article
   author: eric
   date: <datetime from step 1>
   tags: [article]
   teaser: >-
     <prompt user: "What is the teaser for this TIL?">
   ---
   ```

6. After the frontmatter, add a blank line and a comment:
   ```markdown

   <!-- Write your TIL content here -->
   ```

7. Open the newly created file in VS Code by running:

   ```bash
   code www/tils/$1/<slugified-title>.md
   ```

**Important notes:**
- The topic ($1) becomes the directory name under `www/tils/`
- The date MUST include the full timestamp with time, not just the date
- Always use the `-07:00` timezone offset
- If the topic directory doesn't exist yet, create it
