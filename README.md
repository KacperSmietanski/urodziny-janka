# Kroniki Janka

Mobile-first, static birthday RPG for Janek. The app runs directly in a modern browser; no build step, account, or backend is required. Keep `index.html`, `app.js`, and `campaign-data.js` together in the published site folder.

## Run

Open `index.html` in a browser. Quest progress, the inventory, and the finale unlock are stored in that browser's local storage on the device. Quest cards unlock one at a time. The supplied YouTube radio is requested on page load; mobile browsers may require the player’s play button to be tapped. Music needs an internet connection.

## Campaign notes

- The quest list includes all 17 guests from the supplied participant list.
- Patryk Kawiak is encounter 5, Dawid Śmietański is encounter 10, and Julia Kachan is the last encounter. Dawid Budziłek's YouTube video is linked from his quest.
- Five encounters are styled as mysterious NPCs while keeping each character's name visible.
- The finale accepts “sawanna afrykańska” with case, spaces, punctuation, and Polish diacritics ignored.
- Drink counters are optional, include water, and can be changed or reset by the player.

Progress stays on the device unless the player clears browser storage. The YouTube player and optional web font require an internet connection.

