// TaskModel.swift
// Modelo de datos para cada tarea/barra

import SwiftUI

struct TaskItem: Identifiable, Codable {
    var id: UUID = UUID()
    var name: String                    // Nombre de la tarea
    var count: Int = 0                  // Veces que se ha pulsado
    var goal: Int = 100                 // Objetivo total
    var colorHex: String = "#4A90D9"   // Color de la barra en hex
    var streakPositive: Int = 0         // Racha+ días consecutivos dando
    var streakNegative: Int = 0         // Racha- días sin dar
    var lastTapDate: String? = nil      // Última fecha que se pulsó (yyyy-MM-dd)
    var createdDate: String             // Fecha de creación

    // Color computed desde hex
    var color: Color {
        Color(hex: colorHex)
    }

    // Progreso como porcentaje (0.0 a 1.0)
    var progress: Double {
        guard goal > 0 else { return 0 }
        return min(Double(count) / Double(goal), 1.0)
    }
}

// Extensión para convertir hex a Color
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 74, 144, 217)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// Colores predefinidos para elegir
struct PresetColor: Identifiable {
    let id = UUID()
    let name: String
    let hex: String

    var color: Color { Color(hex: hex) }
}

let presetColors: [PresetColor] = [
    PresetColor(name: "Azul", hex: "#4A90D9"),
    PresetColor(name: "Rojo", hex: "#E74C3C"),
    PresetColor(name: "Verde", hex: "#2ECC71"),
    PresetColor(name: "Naranja", hex: "#F39C12"),
    PresetColor(name: "Morado", hex: "#9B59B6"),
    PresetColor(name: "Rosa", hex: "#E91E8A"),
    PresetColor(name: "Turquesa", hex: "#1ABC9C"),
    PresetColor(name: "Amarillo", hex: "#F1C40F"),
    PresetColor(name: "Gris", hex: "#7F8C8D"),
    PresetColor(name: "Marrón", hex: "#8B4513"),
    PresetColor(name: "Coral", hex: "#FF6B6B"),
    PresetColor(name: "Índigo", hex: "#3F51B5"),
]
