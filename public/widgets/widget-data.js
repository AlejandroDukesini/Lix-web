/*
 * Datos del widget de Windows 11 (Tablero de Widgets) a partir de la instantánea que publica
 * la app (la misma estructura que usan los widgets de Android: src/services/native/snapshot.js).
 *
 * Es un script clásico: el Service Worker lo carga con importScripts y las pruebas lo evalúan.
 * No hace peticiones de red ni guarda nada: solo interpreta la instantánea con la hora actual.
 */
(function (scope) {
  var CATEGORIES = {
    reflexion: 'Reflexión', disciplina: 'Disciplina', amor: 'Amor', motivacion: 'Motivación', aprendizaje: 'Aprendizaje',
    superacion: 'Superación', relaciones: 'Relaciones', bienestar: 'Bienestar', creatividad: 'Creatividad', sabiduria: 'Sabiduría',
  };

  function when(iso, withTime, now) {
    var date = new Date(iso);
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var diff = Math.round((day - today) / 86400000);
    var label = diff === 0 ? 'hoy' : diff === 1 ? 'mañana' : date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
    return withTime ? label + ' ' + date.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' }) : label;
  }

  function lixWidgetData(snapshot, now) {
    now = now || new Date();
    if (!snapshot || typeof snapshot !== 'object') {
      return { eyebrow: 'LIX', tip: 'Abre Lix una vez para preparar este widget.', nextClass: '', nextTask: '', nextExam: '', hasAcademic: false, footer: '' };
    }
    var timeline = (snapshot.tips && snapshot.tips.timeline) || [];
    var current = null;
    for (var i = 0; i < timeline.length; i += 1) if (new Date(timeline[i].at) <= now) current = timeline[i];
    current = current || timeline[0] || null;
    var academic = snapshot.academic || {};
    var nextClass = (academic.classes || []).filter(function (c) { return new Date(c.end) > now; })[0];
    var pending = (academic.activities || []).filter(function (a) { return new Date(a.due) > now; });
    var task = pending.filter(function (a) { return !a.evaluation; })[0];
    var exam = pending.filter(function (a) { return a.evaluation; })[0];
    var place = nextClass ? [nextClass.room, nextClass.building].filter(Boolean).join(' · ') : '';
    var data = {
      eyebrow: current ? 'CONSEJO · ' + (CATEGORIES[current.category] || 'Lix').toUpperCase() : 'LIX',
      tip: current ? current.text : 'Sin consejos por ahora.',
      nextClass: nextClass ? 'Clase: ' + nextClass.subject + ' — ' + when(nextClass.start, true, now) + (place ? ' · ' + place : '') : '',
      nextTask: task ? task.typeLabel + ': ' + task.title + ' — ' + when(task.due, task.hasTime, now) : '',
      nextExam: exam ? exam.typeLabel + ': ' + exam.title + ' — ' + when(exam.due, exam.hasTime, now) : '',
      footer: academic.overdue ? academic.overdue + ' actividad(es) vencida(s)' : '',
    };
    data.hasAcademic = Boolean(data.nextClass || data.nextTask || data.nextExam);
    return data;
  }

  scope.lixWidgetData = lixWidgetData;
})(typeof self !== 'undefined' ? self : globalThis);
