# 🔧 DEBUG GUIDE - Synchronizacja

## ✅ CO NAPRAWIŁEM:

### 1. **pullFromCloud() - Merge zamiast nadpisywania**
```javascript
BYŁO: window.S = data.data  // ❌ Nadpisuje cały obiekt
TERAZ: Object.assign(window.S, cloudData)  // ✅ Merguje
```

### 2. **Migracja w pullFromCloud**
```javascript
// Teraz automatycznie migruje otc → remont także po pull z cloud
if (cloudData.otc.length > 0 && cloudData.remont.length === 0) {
  cloudData.remont = cloudData.otc;
  cloudData.otc = [];
}
```

### 3. **save() - uproszczone**
```javascript
// Usuń sprawdzanie syncEnabled
// Zawsze próbuj sync jeśli pushToCloud istnieje
if (typeof window.pushToCloud === 'function') {
  await window.pushToCloud();
}
```

---

## 🧪 JAK TESTOWAĆ:

### **TEST 1: Dodaj zakup i sprawdź sync**
```
1. Zaloguj się
2. Koszty → Zakupy → + Dodaj
3. Nazwa: "Test sync"
4. Kwota: 100
5. Zapisz
6. Sprawdź konsolę (F12):
   ✅ "💾 Saved to localStorage"
   ✅ "☁️ Synced to cloud"
```

### **TEST 2: Multi-device sync**
```
1. Dodaj zakup na komputerze
2. Otwórz na telefonie
3. Zaloguj się
4. Powinieneś zobaczyć zakup
```

### **TEST 3: Konflikt - kto wygra?**
```
1. Dodaj zakup na PC → sync
2. Dodaj zakup na phone → sync
3. Odśwież PC
4. Powinny być OBA zakupy
```

---

## 🔍 DEBUGGING W KONSOLI:

### **Sprawdź czy user zalogowany:**
```javascript
window.supabaseClient.auth.getUser()
```

### **Sprawdź lokalne dane:**
```javascript
window.S
// Zobacz czy ma .zakupy array
```

### **Sprawdź dane w Supabase:**
```javascript
const { data } = await window.supabaseClient
  .from('familock_data')
  .select('*')
  .single();
console.log(data);
```

### **Ręczny push:**
```javascript
await window.pushToCloud()
```

### **Ręczny pull:**
```javascript
// To wywoła onUserLogin który robi pull
await window.pullFromCloud()
```

---

## ⚠️ NAJCZĘSTSZE PROBLEMY:

### **1. "Dodałem zakup ale zniknął"**
```
Przyczyna: pullFromCloud nadpisał lokalne dane
Naprawa: ✅ Object.assign zamiast =
```

### **2. "Nie widać danych po zalogowaniu"**
```
Przyczyna: Nie ma danych w Supabase
Debug:
- Sprawdź czy pierwsza sesja pushła dane
- SELECT * FROM familock_data w Supabase SQL
```

### **3. "Sync nie działa wcale"**
```
Przyczyna: currentUser null lub supabaseClient null
Debug:
- Sprawdź czy auth działa: window.supabaseClient.auth.getSession()
- Sprawdź network tab - czy widać requesty do Supabase?
```

---

## 📊 WORKFLOW SYNCU:

### **Przy logowaniu:**
```
1. Login → onUserLogin()
2. pullFromCloud() - pobiera z Supabase
3. Merguje z lokalnymi danymi (Object.assign)
4. Renderuje UI
```

### **Przy zapisie:**
```
1. Dodaj zakup → save()
2. localStorage.setItem() - lokalnie
3. pushToCloud() - do Supabase
4. Update timestamp
```

### **Realtime sync (automatyczny):**
```
1. Zmiana w Supabase (inne urządzenie)
2. Realtime channel event
3. pullFromCloud() - pobiera nowe dane
4. Merguje + re-render
```

---

## ✅ CHECKLIST PRZED ZGŁOSZENIEM BŁĘDU:

- [ ] Zalogowany? (widget sync pokazuje email)
- [ ] Konsola bez błędów?
- [ ] Network tab - requesty do Supabase?
- [ ] localStorage ma dane? (F12 → Application → localStorage)
- [ ] Supabase ma dane? (SQL: SELECT * FROM familock_data)
- [ ] Timestamp sync aktualizowany? (localStorage.fl4_last_sync)

---

Jeśli dalej nie działa - wyślij screenshot konsoli + network tab!
