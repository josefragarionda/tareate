// ContentView.swift
// Vista principal con las barras de tareas

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: TaskStore
    @State private var showingAddSheet = false
    @State private var editingTask: TaskItem? = nil
    @State private var tappedTaskId: UUID? = nil

    var body: some View {
        NavigationView {
            ZStack {
                // Fondo oscuro
                Color(hex: "#1A1A2E").ignoresSafeArea()

                if store.tasks.isEmpty {
                    // Estado vacío
                    VStack(spacing: 16) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.white.opacity(0.3))
                        Text("Sin tareas")
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.5))
                        Text("Pulsa + para añadir tu primera tarea")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.3))
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(store.tasks) { task in
                                TaskBarView(
                                    task: task,
                                    isTapped: tappedTaskId == task.id,
                                    onTap: {
                                        withAnimation(.spring(response: 0.3)) {
                                            store.tap(task: task)
                                            tappedTaskId = task.id
                                        }
                                        // Reset animación
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                            tappedTaskId = nil
                                        }
                                    },
                                    onEdit: {
                                        editingTask = task
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 20)
                    }
                }
            }
            .navigationTitle("Mis Tareas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Botón Editar (izquierda)
                ToolbarItem(placement: .navigationBarLeading) {
                    if !store.tasks.isEmpty {
                        Menu {
                            ForEach(store.tasks) { task in
                                Button(action: {
                                    editingTask = task
                                }) {
                                    Label(task.name, systemImage: "pencil")
                                }
                            }
                        } label: {
                            Image(systemName: "slider.horizontal.3")
                                .foregroundColor(.white)
                        }
                    }
                }

                // Botón + (derecha)
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showingAddSheet = true
                    }) {
                        Image(systemName: "plus")
                            .font(.title3.bold())
                            .foregroundColor(.white)
                    }
                }
            }
            .toolbarBackground(Color(hex: "#16213E"), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .sheet(isPresented: $showingAddSheet) {
            AddTaskSheet()
                .environmentObject(store)
        }
        .sheet(item: $editingTask) { task in
            EditTaskSheet(task: task)
                .environmentObject(store)
        }
    }
}

// MARK: - Vista de cada barra de tarea

struct TaskBarView: View {
    let task: TaskItem
    let isTapped: Bool
    let onTap: () -> Void
    let onEdit: () -> Void

    var body: some View {
        ZStack(alignment: .leading) {
            // Fondo de la barra (gris oscuro)
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(hex: "#2C2C3E"))
                .frame(height: 80)

            // Barra de progreso coloreada
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 14)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                task.color.opacity(0.8),
                                task.color
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geo.size.width * task.progress, height: 80)
                    .animation(.easeInOut(duration: 0.4), value: task.count)
            }
            .frame(height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 14))

            // Contenido de la barra
            HStack {
                // Izquierda: Rachas (pequeño)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 3) {
                        Image(systemName: "flame.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.green)
                        Text("\(task.streakPositive)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.green)
                    }
                    HStack(spacing: 3) {
                        Image(systemName: "moon.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.red.opacity(0.8))
                        Text("\(task.streakNegative)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.red.opacity(0.8))
                    }
                }
                .frame(width: 45)
                .padding(.leading, 12)

                Spacer()

                // Centro: Contador grande y nombre
                VStack(spacing: 2) {
                    Text(task.name)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(1)

                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("\(task.count)")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundColor(.white)

                        Text("/")
                            .font(.system(size: 18, weight: .light))
                            .foregroundColor(.white.opacity(0.5))

                        Text("\(task.goal)")
                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }

                Spacer()

                // Derecha: espacio simétrico
                Color.clear
                    .frame(width: 45)
                    .padding(.trailing, 12)
            }
        }
        .frame(height: 80)
        .scaleEffect(isTapped ? 0.96 : 1.0)
        .shadow(color: task.color.opacity(isTapped ? 0.6 : 0.2), radius: isTapped ? 8 : 4)
        .onTapGesture {
            onTap()
        }
        .onLongPressGesture {
            onEdit()
        }
    }
}
