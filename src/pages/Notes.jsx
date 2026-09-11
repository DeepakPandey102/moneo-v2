import React, { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Notes() {
  const { data, addNote, updateNote, deleteNote, t } = useApp();
  const { notes } = data;
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  function handleAdd() {
    if (!input.trim()) return;
    addNote(input.trim());
    setInput("");
  }

  function startEdit(n) {
    setEditingId(n.id);
    setEditText(n.text);
  }

  function saveEdit() {
    updateNote(editingId, editText);
    setEditingId(null);
  }

  return (
    <div className="page">
      <div className="page-header"><h1>{t("notes")}</h1></div>

      <div className="card">
        <div className="card-title-row"><span className="card-title">{t("newNote")}</span></div>
        <textarea
          className="note-input"
          rows={3}
          placeholder={t("writeNote")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn-primary" onClick={handleAdd} style={{ marginTop: 8 }}>{t("save")}</button>
      </div>

      <div className="notes-grid">
        {notes.map((n) => (
          <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card note-card">
            <div className="note-date">{n.date}</div>
            {editingId === n.id ? (
              <>
                <textarea className="note-input" rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="note-actions">
                  <button onClick={saveEdit}><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)}><X size={14} /></button>
                </div>
              </>
            ) : (
              <>
                <p className="note-text">{n.text}</p>
                <div className="note-actions">
                  <button onClick={() => startEdit(n)}><Pencil size={14} /></button>
                  <button onClick={() => deleteNote(n.id)}><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
