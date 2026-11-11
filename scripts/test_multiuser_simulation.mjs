import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdxwyvommyyvtzpzmsbm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeHd5dm9tbXl5dnR6cHptc2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjY0OTksImV4cCI6MjEwOTE0MjQ5OX0.Oj0LZzR7Pz5v-LpVB8YDTUnFL1RnXE_r_mE7fPqwqs8';

const testRunId = Date.now().toString().slice(-6);
const testEmail = `voys_sim_${testRunId}@voysgame.test`;
const testPassword = `VoysPass_${testRunId}!`;
const testUsername = `gamer_${testRunId}`;
const testDisplayName = `Test Gamer ${testRunId}`;

const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const results = [];

function logPass(testName, detail = '') {
  results.push({ name: testName, status: 'PASS', detail });
  console.log(`[PASS] ${testName} ${detail ? '(' + detail + ')' : ''}`);
}

function logFail(testName, error) {
  results.push({ name: testName, status: 'FAIL', detail: String(error) });
  console.error(`[FAIL] ${testName}:`, error);
}

async function runTests() {
  console.log('====================================================');
  console.log(`VOYS MULTI-USER SIMULATION TEST - RUN ID: ${testRunId}`);
  console.log('====================================================\n');

  let testUserB = null;
  let testFriendshipId = null;
  let testMessageId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: User Signup & Auto-Confirmation
    // ----------------------------------------------------
    console.log('--- TEST 1: Arkadaş Kayıt & Otomatik E-Posta Onayı ---');
    const { data: signUpData, error: signUpError } = await clientB.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          display_name: testDisplayName,
        }
      }
    });

    if (signUpError) {
      logFail('1. Kayıt İşlemi', signUpError.message);
    } else {
      testUserB = signUpData.user;
      logPass('1. Kayıt İşlemi', `Kullanıcı ID: ${testUserB.id}`);
    }

    // Immediate sign-in verification (Checks if auto_confirm_user trigger worked)
    const { data: signInData, error: signInError } = await clientB.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      logFail('1.1 Anında Giriş (E-posta Onaysız)', signInError.message);
    } else {
      logPass('1.1 Anında Giriş (E-posta Onaysız)', `Oturum token alındı: ${signInData.session ? 'EVET' : 'HAYIR'}`);
    }

    // ----------------------------------------------------
    // TEST 2: Profile Auto-Creation Trigger
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Otomatik Profil Oluşturma (Trigger) ---');
    if (testUserB) {
      const { data: profileData, error: profileError } = await clientB
        .from('profiles')
        .select('*')
        .eq('id', testUserB.id)
        .single();

      if (profileError || !profileData) {
        logFail('2. Profil Kontrolü', profileError?.message || 'Profil kaydı bulunamadı');
      } else {
        logPass('2. Profil Kontrolü', `Kullanıcı: ${profileData.username}, İsim: ${profileData.display_name}`);
      }
    }

    // ----------------------------------------------------
    // TEST 3: User Search (By Username & Display Name)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Kullanıcı Arama ---');
    // Search for existing main user "Lyring"
    const { data: searchResults, error: searchError } = await clientB
      .from('profiles')
      .select('id, username, display_name')
      .or(`username.ilike.%lyring%,display_name.ilike.%lyring%`);

    if (searchError || !searchResults || searchResults.length === 0) {
      logFail('3. Kullanıcı Arama (@Lyring)', searchError?.message || 'Sonuç dönmedi');
    } else {
      const found = searchResults[0];
      logPass('3. Kullanıcı Arama (@Lyring)', `Bulundu: ${found.display_name} (@${found.username}) - ID: ${found.id}`);
    }

    // ----------------------------------------------------
    // TEST 4: Friend Request Workflow
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Arkadaşlık İstek & Onay Döngüsü ---');
    const targetUserId = 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a'; // Lyring

    if (testUserB) {
      // 4.1 Send friend request from User B to Lyring
      const { data: frData, error: frError } = await clientB
        .from('friendships')
        .insert([
          {
            user_id: testUserB.id,
            friend_id: targetUserId,
            status: 'pending',
          }
        ])
        .select()
        .single();

      if (frError || !frData) {
        logFail('4.1 Arkadaşlık İsteği Gönderme', frError?.message);
      } else {
        testFriendshipId = frData.id;
        logPass('4.1 Arkadaşlık İsteği Gönderme', `İstek ID: ${frData.id}, Durum: ${frData.status}`);
      }

      // 4.2 Query friendships as target user (Simulating Lyring viewing requests)
      const { data: friendRows, error: fetchFrError } = await clientA
        .from('friendships')
        .select('*')
        .eq('id', testFriendshipId)
        .single();

      if (fetchFrError || !friendRows) {
        logFail('4.2 Gelen İstekleri Okuma', fetchFrError?.message);
      } else {
        logPass('4.2 Gelen İstekleri Okuma', `Hedef kullanıcı isteği gördü: ${friendRows.id}`);
      }

      // 4.3 Accept friend request
      const { data: acceptData, error: acceptError } = await clientA
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', testFriendshipId)
        .select()
        .single();

      if (acceptError || !acceptData) {
        logFail('4.3 Arkadaşlık İsteği Kabul', acceptError?.message);
      } else {
        logPass('4.3 Arkadaşlık İsteği Kabul', `Yeni durum: ${acceptData.status}`);
      }
    }

    // ----------------------------------------------------
    // TEST 5: Channels, Members & Channel Messaging
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Kanallar, Grup Üyeliği & Canlı Mesajlaşma ---');
    // 5.1 Fetch channels
    const { data: channels, error: chanError } = await clientB
      .from('channels')
      .select('id, name, type')
      .eq('id', 'text-fedailer');

    if (chanError || !channels || channels.length === 0) {
      logFail('5.1 Fedailer Kanalı Erişimi', chanError?.message || 'Kanal bulunamadı');
    } else {
      logPass('5.1 Fedailer Kanalı Erişimi', `Kanal: ${channels[0].name} (${channels[0].type})`);
    }

    // 5.2 Add testUserB to channel_members of text-fedailer
    if (testUserB) {
      const { data: memberData, error: memberError } = await clientB
        .from('channel_members')
        .insert([
          {
            channel_id: 'text-fedailer',
            user_id: testUserB.id,
            role: 'member'
          }
        ])
        .select()
        .single();

      if (memberError) {
        logFail('5.2 Kanala Üye Ekleme', memberError.message);
      } else {
        logPass('5.2 Kanala Üye Ekleme', `Kanal Üye ID: ${memberData.id}`);
      }

      // 5.3 User B sends a message to text-fedailer
      testMessageId = `msg-test-${Date.now()}`;
      const { data: msgData, error: msgError } = await clientB
        .from('channel_messages')
        .insert([
          {
            id: testMessageId,
            channel_id: 'text-fedailer',
            sender_id: testUserB.id,
            sender_name: testDisplayName,
            lines: ['Selam beyler, akşam rekabetçi için Voys hazır mı? 🎮'],
            reactions: [],
            attachments: [],
            sent_at: Date.now()
          }
        ])
        .select()
        .single();

      if (msgError) {
        logFail('5.3 Mesaj Gönderme', msgError.message);
      } else {
        logPass('5.3 Mesaj Gönderme', `Mesaj iletildi: "${msgData.lines[0]}"`);
      }

      // 5.4 Client A reads the message (Simulating other PC reading)
      const { data: receivedMsg, error: readMsgErr } = await clientA
        .from('channel_messages')
        .select('*')
        .eq('id', testMessageId)
        .single();

      if (readMsgErr || !receivedMsg) {
        logFail('5.4 Başka PC Tarafından Mesaj Okuma', readMsgErr?.message);
      } else {
        logPass('5.4 Başka PC Tarafından Mesaj Okuma', `Okunan mesaj: "${receivedMsg.lines[0]}" (${receivedMsg.sender_name})`);
      }
    }

    // ----------------------------------------------------
    // TEST 6: Storage Upload (Chat Attachments & Avatars)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Ek Dosya & Görsel Yükleme (Storage) ---');
    const testFileName = `test-run-${testRunId}.txt`;
    const testContent = Buffer.from(`Voys Gaming Session Test Log ${new Date().toISOString()}`);

    const { data: uploadData, error: uploadErr } = await clientB
      .storage
      .from('chat-attachments')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadErr) {
      logFail('6.1 Chat Attachment Yükleme', uploadErr.message);
    } else {
      const { data: urlData } = clientB.storage.from('chat-attachments').getPublicUrl(testFileName);
      logPass('6.1 Chat Attachment Yükleme', `Dosya: ${uploadData.path}, URL: ${urlData.publicUrl}`);
      // Clean up test file
      await clientB.storage.from('chat-attachments').remove([testFileName]);
    }

    // ----------------------------------------------------
    // TEST 7: Multi-PC WebRTC Voice Signaling via Realtime Presence
    // ----------------------------------------------------
    console.log('\n--- TEST 7: İki Farklı PC Arası WebRTC Ses Sinyalleme & Eşleşme ---');
    const voiceRoomName = `voys_voice_test_room_${testRunId}`;
    let presenceEventReceived = false;

    await new Promise((resolve) => {
      const channelA = clientA.channel(voiceRoomName, {
        config: { presence: { key: 'peer_pc1_lyring' } }
      });

      const channelB = clientB.channel(voiceRoomName, {
        config: { presence: { key: 'peer_pc2_friend' } }
      });

      let timeout = setTimeout(() => {
        logFail('7.1 Realtime Ses Presence Sinyali', 'Zaman aşımı (10s içinde presence senkronu sağlanamadı)');
        try {
          channelA.unsubscribe();
          channelB.unsubscribe();
        } catch {}
        resolve();
      }, 10000);

      channelA
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key === 'peer_pc2_friend') {
            presenceEventReceived = true;
            logPass('7.1 Realtime Ses Presence Sinyali (PC 1 <- PC 2 Algıladı)', `Yeni Katılan Peer: ${key}`);
            clearTimeout(timeout);
            channelA.unsubscribe();
            channelB.unsubscribe();
            resolve();
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channelA.presenceState();
          if (state['peer_pc2_friend']) {
            presenceEventReceived = true;
            logPass('7.1 Realtime Ses Presence Sinyali (Sync)', `PC 2 odada bulundu`);
            clearTimeout(timeout);
            channelA.unsubscribe();
            channelB.unsubscribe();
            resolve();
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channelA.track({
              peerId: 'peer_pc1_lyring',
              userName: 'Lyring',
              joinedAt: Date.now()
            });

            // Now subscribe channel B
            channelB.subscribe(async (bStatus) => {
              if (bStatus === 'SUBSCRIBED') {
                await channelB.track({
                  peerId: 'peer_pc2_friend',
                  userName: 'Test Gamer',
                  joinedAt: Date.now()
                });
              }
            });
          }
        });
    });

  } catch (err) {
    console.error('Beklenmeyen test hatası:', err);
  } finally {
    // ----------------------------------------------------
    // CLEANUP TEST DATA
    // ----------------------------------------------------
    console.log('\n--- TEMİZLİK: Test Verilerinin Temizlenmesi ---');
    try {
      if (testMessageId) {
        await clientA.from('channel_messages').delete().eq('id', testMessageId);
        console.log(`Test mesajı temizlendi: ${testMessageId}`);
      }
      if (testFriendshipId) {
        await clientA.from('friendships').delete().eq('id', testFriendshipId);
        console.log(`Test arkadaşlık kaydı temizlendi: ${testFriendshipId}`);
      }
      if (testUserB) {
        await clientA.from('channel_members').delete().eq('user_id', testUserB.id);
        await clientA.from('profiles').delete().eq('id', testUserB.id);
        console.log(`Test üyelik ve profil temizlendi: ${testUserB.id}`);
      }
    } catch (cleanErr) {
      console.warn('Temizlik uyarısı:', cleanErr);
    }

    console.log('\n====================================================');
    console.log('TEST ÖZETİ:');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`TOPLAM: ${results.length} | BAŞARILI: ${passed} | BAŞARISIZ: ${failed}`);
    console.log('====================================================');
  }
}

runTests();
