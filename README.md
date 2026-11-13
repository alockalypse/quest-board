# Quest Board

Kanban boards for each video game, with ticklist steps, a recipe book per game and notes for next session. It saves to a Google Sheet, so everyone who signs in sees the same boards. The page checks the sheet every few seconds for other people's changes.

## Setup (about 10 minutes)

### 1. Make the sheet and its script
1. Create a blank Google Sheet (call it something like "Quest Board data").
2. Go to **Extensions → Apps Script**. Delete what's in `Code.gs` and paste in [`apps-script/Code.gs`](apps-script/Code.gs). Save.
3. Pick **setup** in the function dropdown and click **Run**. Accept the permission prompts. This creates two tabs:
   - **Users**: who can sign in. Change the `dan` / `change-me` row, and add a row for each friend (username, password, display name). Usernames ignore capitals.
   - **Docs**: where the boards live. Leave this to the page.

### 2. Publish the script as a web app
1. Still in Apps Script: **Deploy → New deployment**, type **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy** and copy the **Web app URL**, which ends in `/exec`.
3. Paste that URL into `API_URL` in [`config.js`](config.js) and commit.

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version**. That keeps the same URL.

### 3. Turn on GitHub Pages
In the repo on GitHub: **Settings → Pages → Deploy from a branch → main / (root)**. The site will be at `https://<your-username>.github.io/quest-board/`.

### 4. Bring your old boards across
The first time someone signs in to an empty sheet, the page offers to import `seed.json`, which holds your boards from the claude.ai version. Click **Import them**. After that you can delete `seed.json` from the repo.

## Good to know
- **Signing in:** each device remembers you until you press **Log out**. Your browser's password manager can save the login too.
- **Security:** this is light protection, built for friends. Passwords are stored as plain text in the Users tab and on each signed-in device. Don't reuse a real password. The script URL is in `config.js`, but nothing can be read or changed without a name and password from the Users tab.
- **Editing the sheet by hand:** this works. Each row in Docs is one item, stored as JSON. The page picks up the change on its next check.
- **Demo mode:** with `API_URL` empty, the page runs on example data and saves nothing.
