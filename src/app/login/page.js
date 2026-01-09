// src/app/login/page.js
"use client";
import { login } from "../actions"; // Vamos criar essa função jájá

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Acessar Painel</h1>
        <form action={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input name="email" type="email" required className="w-full border p-2 rounded" placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input name="password" type="password" required className="w-full border p-2 rounded" placeholder="***" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}