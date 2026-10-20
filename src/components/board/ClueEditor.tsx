// MURAL DE PISTAS — editor de pista (portado do protótipo Nexo).
// Diferença: o limite de anexo segue MAX_FILE_BYTES do data layer (1,5 MB),
// que cabe no save do jogo (localStorage ~5 MB compartilhado com todo o progresso).
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, FileUp, ImagePlus, Plus, Save, ShieldCheck, Upload, X } from 'lucide-react';
import { type Clue, createClue, MAX_FILE_BYTES, newId, typeLabels } from './data';
import { clueIcons } from './Inspector';

export function ClueEditor({ clue, isNew, onSave, onCancel }: { clue: Clue; isNew: boolean; onSave: (clue: Clue) => void; onCancel: () => void }) {
  const [form, setForm] = useState(clue);
  const [tags, setTags] = useState(clue.tags.join(', '));
  const [items, setItems] = useState(clue.items?.map(i => i.text).join('\n') || '');
  const [error, setError] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const isPhoto = ['person', 'location', 'recording'].includes(form.type);
  const update = (key: keyof Clue, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const loadFile = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError('Escolha um arquivo com até 1,5 MB para o salvamento local.'); return; }
    if (isPhoto && !file.type.startsWith('image/')) { setError('Para esta pista, selecione uma imagem.'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, ...(file.type.startsWith('image/') ? { image: reader.result as string } : { fileData: reader.result as string }), fileName: file.name }));
    reader.onerror = () => setError('Não foi possível ler o arquivo. Tente novamente.');
    reader.readAsDataURL(file);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim(), subtitle: form.subtitle.trim(), tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))].slice(0, 10), ...(form.type === 'checklist' ? { items: items.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12).map(text => form.items?.find(i => i.text === text) || { id: newId(), text, done: false }) } : {}) });
  };
  return <form className="editor-form" onSubmit={submit}><div className="modal-body">
    {isNew && <div className="clue-type-picker">{(Object.keys(typeLabels) as (keyof typeof typeLabels)[]).map(type => { const Icon = clueIcons[type]; return <button type="button" key={type} className={form.type === type ? 'active' : ''} onClick={() => { const base = createClue(type); setForm(prev => ({ ...prev, type, width: base.width, height: base.height })); }}><Icon size={17} /><span>{typeLabels[type]}</span></button>; })}</div>}
    <label className="form-field"><span>Título da pista <b>*</b></span><input required maxLength={100} value={form.title} onChange={e => update('title', e.target.value)} placeholder={form.type === 'person' ? 'Ex.: Nome da pessoa' : form.type === 'note' ? 'Qual é a sua hipótese?' : 'Dê um nome a esta pista'} /></label>
    <label className="form-field"><span>{form.type === 'person' ? 'Quem é essa pessoa?' : 'Identificação ou detalhe'}<small>opcional</small></span><input maxLength={100} value={form.subtitle} onChange={e => update('subtitle', e.target.value)} placeholder={form.type === 'person' ? 'Ex.: Curador da galeria · 36 anos' : 'Ex.: Protocolo, endereço ou fonte'} /></label>
    {(isPhoto || form.type === 'document') && <label className="form-field"><span>{form.type === 'document' ? 'Carimbo ou classificação' : form.type === 'recording' ? 'Horário ou etiqueta do registro' : 'Etiqueta da fotografia'}<small>opcional</small></span><input maxLength={45} value={form.badge || ''} onChange={e => update('badge', e.target.value)} placeholder={form.type === 'document' ? 'Ex.: Confidencial' : form.type === 'recording' ? 'Ex.: 21:47:08' : 'Ex.: Testemunha, Desaparecida, Confirmado'} /></label>}
    {(isPhoto || form.type === 'document') && <div className="form-field"><span>{isPhoto ? 'Fotografia' : 'Arquivo anexo'}<small>até 1,5 MB · opcional</small></span><input ref={uploadRef} type="file" className="visually-hidden" accept={isPhoto ? 'image/*' : 'image/*,application/pdf,text/plain,.doc,.docx'} onChange={e => loadFile(e.target.files?.[0])} />{form.image || form.fileData ? <div className="uploaded-file">{form.image ? <img src={form.image} alt="Imagem da pista" /> : <span className="uploaded-file-icon"><FileUp size={23} /></span>}<div><b>{form.fileName || 'Fotografia da pista'}</b><button type="button" onClick={() => uploadRef.current?.click()}>Trocar arquivo</button></div><button type="button" className="icon-button" onClick={() => setForm(prev => ({ ...prev, image: undefined, fileData: undefined, fileName: undefined }))} title="Remover anexo" aria-label="Remover anexo"><X size={17} /></button></div> : <button type="button" className="upload-area" onClick={() => uploadRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }}>{isPhoto ? <ImagePlus size={24} strokeWidth={1.5} /> : <Upload size={24} strokeWidth={1.5} />}<span><b>Clique para escolher</b> ou arraste um arquivo</span><small>{isPhoto ? 'JPG, PNG ou WEBP' : 'PDF, imagem ou documento de texto'}</small></button>}</div>}
    {form.type === 'checklist' && <label className="form-field"><span>Próximos passos<small>uma tarefa por linha</small></span><textarea value={items} onChange={e => setItems(e.target.value)} rows={3} placeholder={'Ouvir a testemunha\nRevisar as câmeras\nConferir os horários'} /></label>}
    <label className="form-field"><span>{form.type === 'note' ? 'Sua anotação' : 'O que sabemos'}<small>opcional</small></span><textarea value={form.content} onChange={e => update('content', e.target.value)} rows={form.type === 'note' ? 4 : 3} maxLength={2500} placeholder="Registre detalhes, perguntas e observações importantes..." /></label>
    {form.type === 'note' && <div className="form-field"><span>Cor do papel</span><div className="note-colors">{[{ value: 'yellow', label: 'Amarelo' }, { value: 'pink', label: 'Rosa' }, { value: 'blue', label: 'Azul' }, { value: 'cream', label: 'Creme' }].map(c => <button type="button" key={c.value} className={`note-color color-${c.value} ${form.color === c.value ? 'active' : ''}`} onClick={() => update('color', c.value)} title={c.label} aria-label={`Papel ${c.label}`} aria-pressed={form.color === c.value}>{form.color === c.value && <Check size={15} />}</button>)}</div></div>}
    <label className="form-field"><span>Etiquetas<small>separadas por vírgulas</small></span><input value={tags} onChange={e => setTags(e.target.value)} placeholder="Ex.: Prioridade, Testemunha, Hipótese" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="modal-footer"><span className="form-saved-note"><ShieldCheck size={13} />Salvo no seu navegador</span><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button type="submit" className="primary-button" disabled={!form.title.trim()}>{isNew ? <Plus size={15} /> : <Save size={15} />}{isNew ? 'Adicionar pista' : 'Salvar alterações'}</button></div></form>;
}
