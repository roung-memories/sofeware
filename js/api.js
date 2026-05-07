/* ============================================
   Data API - IndexedDB + Anthropic API client
   ============================================ */

const API = (() => {
  const _urlCache = {};

  return {
    // ── Materials ──

    getTodayMaterial() {
      const today = new Date().toISOString().split('T')[0];
      return DB.materials.getByDate(today).then((m) => {
        if (!m) {
          const err = new Error('No material for today yet');
          err.status = 404;
          throw err;
        }
        return m;
      });
    },

    async generateMaterial() {
      const apiKey = localStorage.getItem('anthropic_api_key');
      if (!apiKey) throw new Error('API_KEY_MISSING');

      const today = new Date().toISOString().split('T')[0];

      // 1. Delete existing material for today (cascade recordings)
      const existing = await DB.materials.getByDate(today);
      if (existing) {
        await DB.recordings.deleteByMaterialId(existing.id);
        await DB.materials.delete(existing.id);
      }

      // 2. Generate via Anthropic API
      const data = await callAnthropicAPI(apiKey);

      // 3. Save to IndexedDB
      const created = await DB.materials.create({
        title: data.title,
        content_md: data.content_md,
        content_html: data.content_html,
        difficulty: 'intermediate',
        generated_date: today,
        word_count: data.word_count,
        estimated_minutes: data.estimated_minutes,
        created_at: new Date().toISOString(),
      });

      return { ...created, recording_count: 0 };
    },

    listMaterials(page, perPage) {
      return DB.materials.getAll(page, perPage);
    },

    getMaterial(id) {
      return DB.materials.getById(id).then((m) => {
        if (!m) {
          const err = new Error('Material not found');
          err.status = 404;
          throw err;
        }
        return m;
      });
    },

    // ── Recordings ──

    async getRecordings(materialId) {
      const recs = await DB.recordings.getByMaterialId(materialId);
      // Pre-create object URLs for playback, return metadata
      return recs.map((r) => {
        if (r.blob && !_urlCache[r.id]) {
          _urlCache[r.id] = URL.createObjectURL(r.blob);
        }
        return {
          id: r.id,
          material_id: r.material_id,
          duration_secs: r.duration_secs,
          file_size_bytes: r.file_size_bytes,
          created_at: r.created_at,
        };
      });
    },

    async uploadRecording(materialId, audioBlob, durationSecs) {
      const data = {
        material_id: materialId,
        blob: audioBlob,
        duration_secs: durationSecs,
        file_size_bytes: audioBlob.size,
        created_at: new Date().toISOString(),
      };
      const saved = await DB.recordings.create(data);
      // Create blob URL immediately for playback
      _urlCache[saved.id] = URL.createObjectURL(audioBlob);
      return {
        id: saved.id,
        material_id: saved.material_id,
        duration_secs: saved.duration_secs,
        file_size_bytes: saved.file_size_bytes,
        created_at: saved.created_at,
      };
    },

    getAudioUrl(recordingId) {
      return _urlCache[recordingId] || '';
    },

    async deleteRecording(id) {
      if (_urlCache[id]) {
        URL.revokeObjectURL(_urlCache[id]);
        delete _urlCache[id];
      }
      await DB.recordings.delete(id);
    },
  };
})();
