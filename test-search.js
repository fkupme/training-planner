// Тестируем логику множественного поиска

// Пример данных тренировок
const sessions = [
  {
    program_name: "Push Pull Legs",
    day_name: "Push день",
    muscle_groups: {
      primary: "Грудь",
      secondary: ["Плечи", "Трицепс"]
    },
    comments: "Отличная тренировка"
  },
  {
    program_name: "Upper Lower",
    day_name: "Upper день",
    muscle_groups: {
      primary: "Спина",
      secondary: ["Бицепс", "Плечи"]
    },
    comments: "Тяжело, но хорошо"
  },
  {
    program_name: "Push Pull Legs",
    day_name: "Legs день",
    muscle_groups: {
      primary: "Ноги",
      secondary: ["Ягодицы"]
    },
    comments: "Ноги просят пощады"
  }
];

// Функция фильтрации как в коде
function filterSessions(sessions, searchQuery) {
  if (!searchQuery.trim()) return sessions;
  
  const query = searchQuery.toLowerCase().trim();
  const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
  
  return sessions.filter(session => {
    return searchTerms.every(term => {
      // Поиск по основным полям
      const basicMatch = (
        session.program_name?.toLowerCase().includes(term) ||
        session.day_name?.toLowerCase().includes(term) ||
        session.comments?.toLowerCase().includes(term)
      );
      
      // Поиск по мышечным группам
      const muscleMatch = (
        session.muscle_groups.primary.toLowerCase().includes(term) ||
        session.muscle_groups.secondary.some(muscle => 
          muscle.toLowerCase().includes(term)
        )
      );
      
      return basicMatch || muscleMatch;
    });
  });
}

// Тесты
console.log("=== ТЕСТЫ ПОИСКА ===\n");

console.log("1. Поиск по одной мышце 'Грудь':");
let result = filterSessions(sessions, "Грудь");
console.log(`Найдено: ${result.length} тренировок`);
result.forEach(s => console.log(`- ${s.program_name}, ${s.muscle_groups.primary}`));

console.log("\n2. Поиск по двум мышцам 'Грудь Плечи':");
result = filterSessions(sessions, "Грудь Плечи");
console.log(`Найдено: ${result.length} тренировок`);
result.forEach(s => console.log(`- ${s.program_name}, ${s.muscle_groups.primary}, [${s.muscle_groups.secondary.join(', ')}]`));

console.log("\n3. Поиск по трем мышцам 'Грудь Плечи Трицепс':");
result = filterSessions(sessions, "Грудь Плечи Трицепс");
console.log(`Найдено: ${result.length} тренировок`);
result.forEach(s => console.log(`- ${s.program_name}, ${s.muscle_groups.primary}, [${s.muscle_groups.secondary.join(', ')}]`));

console.log("\n4. Поиск по программе и мышце 'Push Плечи':");
result = filterSessions(sessions, "Push Плечи");
console.log(`Найдено: ${result.length} тренировок`);
result.forEach(s => console.log(`- ${s.program_name}, ${s.muscle_groups.primary}, [${s.muscle_groups.secondary.join(', ')}]`));

console.log("\n5. Поиск несовместимой комбинации 'Грудь Ноги':");
result = filterSessions(sessions, "Грудь Ноги");
console.log(`Найдено: ${result.length} тренировок`);
result.forEach(s => console.log(`- ${s.program_name}, ${s.muscle_groups.primary}, [${s.muscle_groups.secondary.join(', ')}]`));
