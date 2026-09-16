import { supabase } from './supabase-client.js';
import { ALLOWED_EMAIL } from './config.js';

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAllowedUser(user) {
  return normalizedEmail(user?.email) === ALLOWED_EMAIL;
}

export async function getAllowedSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) return null;
  if (!isAllowedUser(session.user)) {
    await supabase.auth.signOut();
    throw new Error('This account is not allowed to use My Money Plan.');
  }
  return session;
}

export async function signIn(password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ALLOWED_EMAIL,
    password,
  });
  if (error) throw error;
  if (!isAllowedUser(data.user)) {
    await supabase.auth.signOut();
    throw new Error('This account is not allowed to use My Money Plan.');
  }
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
