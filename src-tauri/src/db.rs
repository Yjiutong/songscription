//! The SQLite bridge.
//!
//! Four functions and no opinion about the schema. The statements come from
//! src/lib/db.ts, which is also where the row-to-`Piece` mapping lives, so the
//! shape of the catalogue is defined in exactly one file and this one only has
//! to move values across the boundary intact.

use rusqlite::types::ValueRef;
use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde_json::{Map, Value};
use std::path::Path;

/// Open the catalogue, in the mode a single-user app wants: WAL so a read never
/// waits on a write, and NORMAL because a power cut costing the last write is a
/// better trade than an fsync per bookmark.
pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(conn)
}

/// JSON in, SQLite values out. The frontend never sends a blob, so the four
/// scalar types are the whole contract; anything else is stringified rather
/// than silently dropped.
fn bindings(params: Vec<Value>) -> Vec<SqlValue> {
    params
        .into_iter()
        .map(|value| match value {
            Value::Null => SqlValue::Null,
            Value::Bool(flag) => SqlValue::Integer(i64::from(flag)),
            Value::Number(number) => match number.as_i64() {
                Some(int) => SqlValue::Integer(int),
                None => SqlValue::Real(number.as_f64().unwrap_or(0.0)),
            },
            Value::String(text) => SqlValue::Text(text),
            other => SqlValue::Text(other.to_string()),
        })
        .collect()
}

/// SQLite value out, JSON in.
fn to_json(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(int) => Value::from(int),
        ValueRef::Real(real) => Value::from(real),
        ValueRef::Text(bytes) => Value::from(String::from_utf8_lossy(bytes).into_owned()),
        // Nothing in this schema is a blob; if one ever appears, showing its
        // text form beats returning nothing and pretending the column is empty.
        ValueRef::Blob(bytes) => Value::from(String::from_utf8_lossy(bytes).into_owned()),
    }
}

/// Run one statement. The result is rows changed, which is how the caller
/// learns that an UPDATE matched nothing.
pub fn run(conn: &Connection, sql: &str, params: Vec<Value>) -> Result<usize, String> {
    let bound = bindings(params);
    conn.execute(sql, params_from_iter(bound))
        .map_err(|error| error.to_string())
}

/// Run one query, returning rows keyed by column name — the same shape sql.js
/// produces in the development build, so the TypeScript above cannot tell them
/// apart.
pub fn all(conn: &Connection, sql: &str, params: Vec<Value>) -> Result<Vec<Value>, String> {
    let bound = bindings(params);
    let mut statement = conn.prepare(sql).map_err(|error| error.to_string())?;
    let columns: Vec<String> = statement
        .column_names()
        .into_iter()
        .map(str::to_owned)
        .collect();

    let mut rows = statement
        .query(params_from_iter(bound))
        .map_err(|error| error.to_string())?;

    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut entry = Map::with_capacity(columns.len());
        for (index, name) in columns.iter().enumerate() {
            let value = row.get_ref(index).map_err(|error| error.to_string())?;
            entry.insert(name.clone(), to_json(value));
        }
        out.push(Value::Object(entry));
    }
    Ok(out)
}

/// Schema creation, and anything else that is several statements at once.
pub fn exec(conn: &Connection, sql: &str) -> Result<(), String> {
    conn.execute_batch(sql).map_err(|error| error.to_string())
}
