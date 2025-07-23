# Dockerfile per ambiente C++
FROM codercom/code-server:latest

USER root

# Installa compilatori C++ e strumenti di sviluppo
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    gcc \
    gdb \
    cmake \
    make \
    clang \
    lldb \
    valgrind \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Installa estensioni VS Code per C++
RUN code-server --install-extension ms-vscode.cpptools && \
    code-server --install-extension ms-vscode.cmake-tools && \
    code-server --install-extension twxs.cmake

USER coder

# Crea progetto di esempio
WORKDIR /home/coder/project
RUN echo '#include <iostream>\n#include <vector>\n#include <string>\n#include <chrono>\n#include <iomanip>\n\nusing namespace std;\nusing namespace chrono;\n\nclass Calculator {\npublic:\n    static int add(int a, int b) {\n        return a + b;\n    }\n    \n    static int multiply(int a, int b) {\n        return a * b;\n    }\n    \n    static double divide(double a, double b) {\n        if (b == 0) {\n            throw invalid_argument("Divisione per zero!");\n        }\n        return a / b;\n    }\n};\n\nint main() {\n    auto now = system_clock::now();\n    auto time_t = system_clock::to_time_t(now);\n    \n    cout << "⚡ Hello C++!" << endl;\n    cout << "Timestamp: " << put_time(localtime(&time_t), "%Y-%m-%d %H:%M:%S") << endl;\n    cout << "Compiler: " << __VERSION__ << endl;\n    \n    // Esempio di utilizzo della classe Calculator\n    cout << "\\n🧮 Esempi Calculator:" << endl;\n    cout << "5 + 3 = " << Calculator::add(5, 3) << endl;\n    cout << "5 * 3 = " << Calculator::multiply(5, 3) << endl;\n    \n    try {\n        cout << "10 / 2 = " << Calculator::divide(10, 2) << endl;\n    } catch (const exception& e) {\n        cout << "Errore: " << e.what() << endl;\n    }\n    \n    return 0;\n}' > main.cpp

RUN echo 'cmake_minimum_required(VERSION 3.10)\nproject(CppEnvironment)\n\nset(CMAKE_CXX_STANDARD 17)\nset(CMAKE_CXX_STANDARD_REQUIRED ON)\n\n# Aggiungi flags di debug\nset(CMAKE_CXX_FLAGS_DEBUG "-g -O0 -Wall -Wextra")\nset(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG")\n\n# Eseguibile principale\nadd_executable(main main.cpp)\n\n# Aggiungi altri target se necessario\n# add_executable(example example.cpp)' > CMakeLists.txt

RUN echo 'CC=g++\nCXXFLAGS=-std=c++17 -Wall -Wextra -g\nTARGET=main\nSOURCE=main.cpp\n\n# Target principale\n$(TARGET): $(SOURCE)\n\t$(CC) $(CXXFLAGS) -o $(TARGET) $(SOURCE)\n\n# Target per eseguire\nrun: $(TARGET)\n\t./$(TARGET)\n\n# Pulizia\nclean:\n\trm -f $(TARGET)\n\n# Target per debug con gdb\ndebug: $(TARGET)\n\tgdb ./$(TARGET)\n\n# Phony targets\n.PHONY: run clean debug' > Makefile

RUN echo '# C++ Environment ⚡\n\n## Come compilare ed eseguire\n\n### Metodo 1: Using Make\n```bash\n# Compila\nmake\n\n# Esegui\nmake run\n\n# Debug\nmake debug\n\n# Pulisci\nmake clean\n```\n\n### Metodo 2: Using CMake\n```bash\n# Crea cartella build\nmkdir build && cd build\n\n# Configura progetto\ncmake ..\n\n# Compila\nmake\n\n# Esegui\n./main\n```\n\n### Metodo 3: Compilazione diretta\n```bash\n# Compila\ng++ -std=c++17 -Wall -Wextra -g -o main main.cpp\n\n# Esegui\n./main\n```\n\n## Struttura progetto\n- `main.cpp` - File principale con esempi\n- `CMakeLists.txt` - Configurazione CMake\n- `Makefile` - Configurazione Make\n- `README.md` - Questo file\n\n## Strumenti installati\n- **Compilatori**: g++, gcc, clang\n- **Debugger**: gdb, lldb\n- **Build tools**: make, cmake\n- **Memory tools**: valgrind\n- **Standard**: C++17 supportato\n\n## Estensioni VS Code installate\n- C++ IntelliSense support\n- CMake tools\n- CMake syntax highlighting\n\n## Tips per sviluppo\n- Usa `Ctrl+Shift+P` → "C++: Build and Debug" per debug integrato\n- Configura breakpoint cliccando a sinistra del numero di riga\n- Il linting è attivo per mostrare errori in tempo reale' > README.md

EXPOSE 8080
CMD ["--auth", "none", "--bind-addr", "0.0.0.0:8080"]
