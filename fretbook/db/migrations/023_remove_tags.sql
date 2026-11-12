DROP TRIGGER song_tags_fts_insert;
DROP TRIGGER song_tags_fts_delete;
DROP TRIGGER song_tags_fts_update;
DROP TRIGGER songs_fts_insert;
DROP TRIGGER songs_fts_delete;
DROP TRIGGER songs_fts_update;

CREATE VIRTUAL TABLE songs_fts_new USING fts5(
    song_id UNINDEXED,
    title,
    artist,
    lyrics,
    tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO songs_fts_new (song_id, title, artist, lyrics)
SELECT song_id, title, artist, lyrics FROM songs_fts;

DROP TABLE songs_fts;
ALTER TABLE songs_fts_new RENAME TO songs_fts;
DROP TABLE song_tags;
UPDATE songs
SET source_ref = CASE WHEN json_valid(source_ref) THEN json_remove(source_ref, '$.tags') ELSE source_ref END;

CREATE TRIGGER songs_fts_insert AFTER INSERT ON songs BEGIN
    INSERT INTO songs_fts (song_id, title, artist, lyrics) VALUES (new.id, new.title, new.artist, '');
END;

CREATE TRIGGER songs_fts_delete AFTER DELETE ON songs BEGIN
    DELETE FROM songs_fts WHERE song_id = old.id;
END;

CREATE TRIGGER songs_fts_update AFTER UPDATE OF title, artist ON songs BEGIN
    UPDATE songs_fts SET title = new.title, artist = new.artist WHERE song_id = old.id;
END;
