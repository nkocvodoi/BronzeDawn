// The one rules file, shared with the Mac build and checked by balance.py, and the fantasy races on top.
import file from "../../../data/rules.json";
import fantasy from "../../../data/fantasy.json";
import { Rules, RulesAddon, RulesFile, withAddon } from "./rules";

export const RULES = new Rules(withAddon(file as unknown as RulesFile, fantasy as unknown as RulesAddon));
