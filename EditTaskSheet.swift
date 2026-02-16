// EditTaskSheet.swift
// Ventana para editar una tarea existente

import SwiftUI

struct EditTaskSheet: View {
    @EnvironmentObject var store: TaskStore
    @Environment(\.dismiss) var dismiss

    let task: TaskItem

    @State private var name: String = ""
    @State private var goalText: String = ""
    @State private var selectedColorHex: String = ""
    @State private var showDeleteConfirm = false
    @State private var showResetConfirm = false

    var body: some View {
        NavigationView {
            ZStack {
                Color(hex: "#1A1A2E").ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Estadísticas actuales
                        HStack(spacing: 20) {
                            StatBox(title: "Contador", value: "\(task.count)", icon: "hand.tap.fill")
                            StatBox(title: "Racha+", value: "\(task.streakPositive)", icon: "flame.fill")
                            StatBox(title: "Racha-", value: "\(task.streakNegative)", icon: "moon.fill")
                        }

                        // Nombre
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Nombre de la tarea")
                                .font(.subheadline.bold())
                                .foregroundColor(.white.opacity(0.7))

                            TextField("Nombre", text: $name)
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

                        // Color
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

                        Spacer(minLength: 20)

                        // Botón guardar
                        Button(action: {
                            let goal = Int(goalText) ?? task.goal
                            store.updateTask(
                                id: task.id,
                                name: name.isEmpty ? task.name : name,
                                goal: max(goal, 1),
                                colorHex: selectedColorHex
                            )
                            dismiss()
                        }) {
                            Text("Guardar Cambios")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(16)
                                .background(Color(hex: selectedColorHex))
                                .cornerRadius(14)
                        }

                        // Botón resetear contador
                        Button(action: {
                            showResetConfirm = true
                        }) {
                            HStack {
                                Image(systemName: "arrow.counterclockwise")
                                Text("Resetear contador a 0")
                            }
                            .font(.subheadline)
                            .foregroundColor(.orange)
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(10)
                        }

                        // Botón eliminar
                        Button(action: {
                            showDeleteConfirm = true
                        }) {
                            HStack {
                                Image(systemName: "trash.fill")
                                Text("Eliminar tarea")
                            }
                            .font(.subheadline)
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(10)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Editar Tarea")
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
            .alert("¿Eliminar tarea?", isPresented: $showDeleteConfirm) {
                Button("Cancelar", role: .cancel) {}
                Button("Eliminar", role: .destructive) {
                    store.deleteTask(id: task.id)
                    dismiss()
                }
            } message: {
                Text("Se perderán todos los datos de \"\(task.name)\". Esta acción no se puede deshacer.")
            }
            .alert("¿Resetear contador?", isPresented: $showResetConfirm) {
                Button("Cancelar", role: .cancel) {}
                Button("Resetear", role: .destructive) {
                    store.resetCount(id: task.id)
                    dismiss()
                }
            } message: {
                Text("El contador de \"\(task.name)\" volverá a 0 y se perderán las rachas.")
            }
            .onAppear {
                name = task.name
                goalText = "\(task.goal)"
                selectedColorHex = task.colorHex
            }
        }
    }
}

// MARK: - Caja de estadística

struct StatBox: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.white.opacity(0.5))
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            Text(title)
                .font(.system(size: 10))
                .foregroundColor(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(hex: "#2C2C3E"))
        .cornerRadius(10)
    }
}
