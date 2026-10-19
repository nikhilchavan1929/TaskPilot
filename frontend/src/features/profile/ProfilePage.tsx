import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../../shared/api/client';
import type { UserProfile } from '../../shared/api/types';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void apiClient.get<UserProfile>('/users/me')
      .then(({ data }) => { if (active) setProfile(data); })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const { data } = await apiClient.patch<UserProfile>('/users/me', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        birthDate: profile.birthDate || null,
        avatarUrl: profile.avatarUrl || null,
      });
      setProfile(data);
      updateProfile({ firstName: data.firstName, lastName: data.lastName, avatarUrl: data.avatarUrl });
      setNotice('Profile updated.');
    } catch (error) {
      if (isAxiosError<{ message?: string | string[] }>(error)) {
        const message = error.response?.data?.message;
        setError(Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'Could not save your profile. Check each field and try again.');
      } else setError('Could not save your profile. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function change(field: 'firstName' | 'lastName' | 'birthDate' | 'avatarUrl', value: string) {
    const nextValue = field === 'firstName' || field === 'lastName' ? value : value || null;
    setProfile((current) => current ? { ...current, [field]: nextValue } : current);
  }

  return (
    <section className="page-card profile-card">
      <p className="eyebrow">Account</p>
      <h1>My profile</h1>
      <p className="muted-copy">Manage the personal details shown in your workspace.</p>
      {loading ? <p role="status">Loading profile…</p> : loadFailed ? (
        <div role="alert">
          <p className="form-error">Could not load your profile. Your changes have not been saved.</p>
          <button className="quiet-button" onClick={() => setReloadKey((key) => key + 1)} type="button">Try again</button>
        </div>
      ) : profile ? (
        <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-preview">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile preview" /> : <span aria-hidden="true">{profile.firstName?.[0] || profile.email[0] || '?'}</span>}
          </div>
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={profile.email} readOnly />
          <div className="form-row">
            <div><label htmlFor="first-name">First name</label><input id="first-name" maxLength={80} onChange={(event) => change('firstName', event.target.value)} value={profile.firstName ?? ''} /></div>
            <div><label htmlFor="last-name">Last name</label><input id="last-name" maxLength={80} onChange={(event) => change('lastName', event.target.value)} value={profile.lastName ?? ''} /></div>
          </div>
          <div className="form-row">
            <div><label htmlFor="birth-date">Birth date</label><input id="birth-date" onChange={(event) => change('birthDate', event.target.value)} type="date" value={profile.birthDate ?? ''} /></div>
            <div><label htmlFor="avatar-url">Profile picture URL</label><input id="avatar-url" onChange={(event) => change('avatarUrl', event.target.value)} placeholder="https://…" type="url" value={profile.avatarUrl ?? ''} /></div>
          </div>
          <p className="field-hint">Use an HTTPS image URL. Image uploads can be connected to a storage provider later.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="success-message" role="status">{notice}</p>}
          <button className="primary-button submit-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save profile'}</button>
        </form>
      ) : null}
    </section>
  );
}
