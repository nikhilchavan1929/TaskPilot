import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../shared/api/client';
import type { UserProfile } from '../../shared/api/types';
import { useAuth } from '../auth/AuthContext';

const emptyProfile: UserProfile = {
  id: '', email: '', role: '', firstName: '', lastName: '', birthDate: null, avatarUrl: null,
};

export function ProfilePage() {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiClient.get<UserProfile>('/users/me')
      .then(({ data }) => { if (active) setProfile(data); })
      .catch(() => { if (active) setError('Could not load your profile. Try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      updateProfile(data);
      setNotice('Profile updated.');
    } catch {
      setError('Could not save your profile. Check the image URL and try again.');
    } finally {
      setSaving(false);
    }
  }

  function change(field: 'firstName' | 'lastName' | 'birthDate' | 'avatarUrl', value: string) {
    setProfile((current) => ({ ...current, [field]: value || null }));
  }

  return (
    <section className="page-card profile-card">
      <p className="eyebrow">Account</p>
      <h1>My profile</h1>
      <p className="muted-copy">Manage the personal details shown in your workspace.</p>
      {loading ? <p role="status">Loading profile…</p> : (
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
      )}
    </section>
  );
}
