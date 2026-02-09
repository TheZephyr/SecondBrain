import {
  Folder,
  Gamepad2,
  Book,
  Film,
  Music,
  ChefHat,
  Dumbbell,
  Plane,
  FileText,
  Briefcase,
  Palette,
  Wrench,
  Home,
  DollarSign,
  BarChart3,
  Target,
} from "lucide-vue-next";
import type { Component } from "vue";

export function useIcons() {
  const iconOptions: Array<{
    value: string;
    label: string;
    component: Component;
  }> = [
    { value: "folder", label: "Folder", component: Folder },
    { value: "gamepad2", label: "Games", component: Gamepad2 },
    { value: "book", label: "Books", component: Book },
    { value: "film", label: "Movies", component: Film },
    { value: "music", label: "Music", component: Music },
    { value: "chefhat", label: "Recipes", component: ChefHat },
    { value: "dumbbell", label: "Fitness", component: Dumbbell },
    { value: "plane", label: "Travel", component: Plane },
    { value: "filetext", label: "Notes", component: FileText },
    { value: "briefcase", label: "Work", component: Briefcase },
    { value: "palette", label: "Art", component: Palette },
    { value: "wrench", label: "Projects", component: Wrench },
    { value: "home", label: "Home", component: Home },
    { value: "dollarsign", label: "Finance", component: DollarSign },
    { value: "barchart3", label: "Analytics", component: BarChart3 },
    { value: "target", label: "Goals", component: Target },
  ];

  const iconMap: Record<string, Component> = {
    folder: Folder,
    gamepad2: Gamepad2,
    book: Book,
    film: Film,
    music: Music,
    chefhat: ChefHat,
    dumbbell: Dumbbell,
    plane: Plane,
    filetext: FileText,
    briefcase: Briefcase,
    palette: Palette,
    wrench: Wrench,
    home: Home,
    dollarsign: DollarSign,
    barchart3: BarChart3,
    target: Target,
  };

  function getIcon(iconName: string) {
    return iconMap[iconName] || Folder;
  }

  return {
    iconOptions,
    iconMap,
    getIcon,
  };
}
