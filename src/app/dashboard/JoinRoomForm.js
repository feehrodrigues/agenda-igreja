"use client";
import { useState } from 'react';
import { joinRoom } from '../actions';
import { useRouter } from 'next/navigation';

export default function JoinRoomForm() {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const result = await joinRoom(formData);
    if (result.success) {
      setMessage(result.message);
      setError(null);
      e.target.reset();
      router.refresh();
    } else {
      setError(result.error);
      setMessage(null);
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-slate-200">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Entrar em uma Sala</h2>
      <p className="text-sm text-slate-500 mb-8">Use o código de convite do administrador.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">Código de Convite</label>
          <input name="inviteCode" required placeholder="Cole o código aqui" className="w-full p-4 bg-slate-100 border-2 rounded-lg text-black font-semibold" />
        </div>
        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold">Entrar na Sala</button>
        {message && <p className="text-emerald-600 font-bold mt-2 text-sm">{message}</p>}
        {error && <p className="text-red-600 font-bold mt-2 text-sm">{error}</p>}
      </form>
    </div>
  );
}