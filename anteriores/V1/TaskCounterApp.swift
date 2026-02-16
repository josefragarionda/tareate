// TaskCounterApp.swift
// App principal - Contador de Tareas para iPhone
// Funciona 100% en local sin conexión a internet

import SwiftUI

@main
struct TaskCounterApp: App {
    @StateObject private var store = TaskStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
