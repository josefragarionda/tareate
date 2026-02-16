// AddTaskSheet.swift
// Ventana para añadir una nueva tarea

import SwiftUI

struct AddTaskSheet: View {
    @EnvironmentObject var store: TaskStore
    @Environment(\.dismiss) var dismiss

    @State private var name: String = ""
    @State private var goalText: String = "100"
    @State private var selectedColorHex: String = "#4A90D9"

    var body: some View {
        NavigationView {
            ZStack {
                Color(hex: "#1A1A2E").ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Nombre de la tarea
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Nombre de la tarea")
                                .font(.subheadline.bold())
                                .foregroundColor(.white.opacity(0.7))

                            TextField("Ej: Ejercicio, Lectura...", text: $name)
                                .textFieldStyle(.plain)
                                .padding(14)
                                .background(Color(hex: "#2C2C3E"))
                                .cornerRadius(10)
                                .foregroundColor(.white)
                        }

                        // Objetivo
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Objetivo total")
                                .font(.subheadline.bold())
                                .foregroundColor(.white.opacity(0.7))

                            TextField("100", text: $goalText)
                                .textFieldStyle(.plain)
                                .keyboardType(.numberPad)
                                .padding(14)
                                .background(Color(hex: "#2C2C3E"))
                                .cornerRadius(10)
                                .foregroundColor(.white)
                        }

                        // Selector de color
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Color de la barra")
                                .font(.subheadline.bold())
                                .foregroundColor(.white.opacity(0.7))

                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 12) {
                                ForEach(presetColors) { preset in
                                    Circle()
                                        .fill(preset.color)
                                        .frame(width: 44, height: 44)
                                        .overlay(
                                            Circle()
                                                .stroke(Color.white, lineWidth: selectedColorHex == preset.hex ? 3 : 0)
                                        )
                                        .scaleEffect(selectedColorHex == preset.hex ? 1.1 : 1.0)
                                        .onTapGesture {
                                            withAnimation(.spring(response: 0.3)) {
                                                selectedColorHex = preset.hex
                                            }
                                        }
                                }
                            }
                        }

                        // Vista previa
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Vista previa")
                                .font(.subheadline.bold())
                                .foregroundColor(.white.opacity(0.7))

                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(Color(hex: "#2C2C3E"))
                                    .frame(height: 70)

                                RoundedRectangle(cornerRadius: 14)
                                    .fill(Color(hex: selectedColorHex).opacity(0.6))
                                    .frame(width: 120, height: 70)

                                HStack {
                                    Spacer()
                                    VStack(spacing: 2) {
                                        Text(name.isEmpty ? "Tarea" : name)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.white.opacity(0.7))
                                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                                            Text("0")
                                                .font(.system(size: 30, weight: .bold, design: .rounded))
                                                .foregroundColor(.white)
                                            Text("/")
                                                .font(.system(size: 16, weight: .light))
                                                .foregroundColor(.white.opacity(0.5))
                                            Text(goalText.isEmpty ? "0" : goalText)
                                                .font(.system(size: 16, weight: .semibold, design: .rounded))
                                                .foregroundColor(.white.opacity(0.7))
                                        }
                                    }
                                    Spacer()
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }

                        Spacer(minLength: 20)

                        // Botón crear
                        Button(action: {
                            let goal = Int(goalText) ?? 100
                            store.addTask(
                                name: name.isEmpty ? "Sin nombre" : name,
                                goal: max(goal, 1),
                                colorHex: selectedColorHex
                            )
                            dismiss()
                        }) {
                            Text("Crear Tarea")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(16)
                                .background(Color(hex: selectedColorHex))
                                .cornerRadius(14)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Nueva Tarea")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancelar") {
                        dismiss()
                    }
                    .foregroundColor(.white.opacity(0.7))
                }
            }
            .toolbarBackground(Color(hex: "#16213E"), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}
