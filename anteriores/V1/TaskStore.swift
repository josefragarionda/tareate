// TaskStore.swift
// Almacén de datos con persistencia local usando JSON en UserDefaults

import SwiftUI

class TaskStore: ObservableObject {
    @Published var tasks: [TaskItem] = [] {
        didSet {
            save()
        }
    }

    private let storageKey = "taskCounter_tasks"

    init() {
        load()
        updateAllStreaks()
    }

    // MARK: - Persistencia local (JSON en UserDefaults)

    private func save() {
        if let data = try? JSONEncoder().encode(tasks) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([TaskItem].self, from: data) else {
            return
        }
        tasks = decoded
    }

    // MARK: - Fecha actual como string

    private func todayString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private func daysBetween(from: String, to: String) -> Int {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date1 = formatter.date(from: from),
              let date2 = formatter.date(from: to) else { return 0 }
        let components = Calendar.current.dateComponents([.day], from: date1, to: date2)
        return components.day ?? 0
    }

    // MARK: - Actualizar rachas al abrir la app

    func updateAllStreaks() {
        let today = todayString()
        for i in tasks.indices {
            if let lastDate = tasks[i].lastTapDate {
                let daysDiff = daysBetween(from: lastDate, to: today)
                if daysDiff > 1 {
                    // Han pasado más de 1 día sin dar → racha+ se resetea
                    tasks[i].streakPositive = 0
                    tasks[i].streakNegative = daysDiff
                } else if daysDiff == 1 {
                    // Ayer se dio pero hoy aún no → racha- = 1
                    // La racha+ se mantiene hasta que pasen 2 días
                    tasks[i].streakNegative = 1
                }
                // Si daysDiff == 0, ya se dio hoy, no cambiar nada
            }
        }
    }

    // MARK: - Tap en una tarea (sumar 1)

    func tap(task: TaskItem) {
        guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }

        let today = todayString()
        let lastDate = tasks[index].lastTapDate

        // Sumar 1 al contador
        tasks[index].count += 1

        // Actualizar rachas
        if let lastDate = lastDate {
            let daysDiff = daysBetween(from: lastDate, to: today)
            if daysDiff == 0 {
                // Ya se dio hoy, solo suma (racha no cambia)
            } else if daysDiff == 1 {
                // Se dio ayer → racha consecutiva sigue
                tasks[index].streakPositive += 1
                tasks[index].streakNegative = 0
            } else {
                // Más de 1 día sin dar → nueva racha
                tasks[index].streakPositive = 1
                tasks[index].streakNegative = 0
            }
        } else {
            // Primera vez que se da
            tasks[index].streakPositive = 1
            tasks[index].streakNegative = 0
        }

        tasks[index].lastTapDate = today

        // Reordenar: más puntuación arriba
        sortTasks()
    }

    // MARK: - Ordenar por puntuación (mayor arriba)

    func sortTasks() {
        tasks.sort { $0.count > $1.count }
    }

    // MARK: - Añadir tarea

    func addTask(name: String, goal: Int, colorHex: String) {
        let newTask = TaskItem(
            name: name,
            goal: goal,
            colorHex: colorHex,
            createdDate: todayString()
        )
        tasks.append(newTask)
        sortTasks()
    }

    // MARK: - Editar tarea

    func updateTask(id: UUID, name: String, goal: Int, colorHex: String) {
        guard let index = tasks.firstIndex(where: { $0.id == id }) else { return }
        tasks[index].name = name
        tasks[index].goal = goal
        tasks[index].colorHex = colorHex
    }

    // MARK: - Eliminar tarea

    func deleteTask(id: UUID) {
        tasks.removeAll { $0.id == id }
    }

    // MARK: - Resetear contador de una tarea

    func resetCount(id: UUID) {
        guard let index = tasks.firstIndex(where: { $0.id == id }) else { return }
        tasks[index].count = 0
        tasks[index].streakPositive = 0
        tasks[index].streakNegative = 0
        tasks[index].lastTapDate = nil
        sortTasks()
    }
}
