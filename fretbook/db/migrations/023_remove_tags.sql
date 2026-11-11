DROP TRIGGER IF EXISTS song_tags_fts_insert;
DROP TRIGGER IF EXISTS song_tags_fts_delete;
DROP TRIGGER IF EXISTS song_tags_fts_update;
DROP TRIGGER IF EXISTS songs_fts_insert;
DROP TRIGGER IF EXISTS songs_fts_delete;
DROP TRIGGER IF EXISTS songs_fts_update;

CREATE TEMP TABLE songs_fts_backup AS
SELECT song_id, title, artist, lyrics FROM songs_fts;

DROP TABLE songs_fts;
DROP TABLE song_tags;
UPDATE songs
SET source_ref = json_remove(source_ref, '$.tags')
WHERE json_valid(source_ref) AND json_type(source_ref, '$.tags') IS NOT NULL;
UPDATE jobs
SET payload = json_remove(payload, '$.tags')
WHERE json_valid(payload) AND json_type(payload, '$.tags') IS NOT NULL;

CREATE VIRTUAL TABLE songs_fts USING fts5(
    song_id UNINDEXED,
    title,
    artist,
    lyrics,
    tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO songs_fts (song_id, title, artist, lyrics)
SELECT song_id, title, artist, lyrics FROM songs_fts_backup;

DROP TABLE songs_fts_backup;

CREATE TRIGGER songs_fts_insert AFTER INSERT ON songs BEGIN
    INSERT INTO songs_fts (song_id, title, artist, lyrics) VALUES (new.id, new.title, new.artist, '');
END;

CREATE TRIGGER songs_fts_delete AFTER DELETE ON songs BEGIN
    DELETE FROM songs_fts WHERE song_id = old.id;
END;

CREATE TRIGGER songs_fts_update AFTER UPDATE OF title, artist ON songs BEGIN
    UPDATE songs_fts SET title = new.title, artist = new.artist WHERE song_id = old.id;
END;
