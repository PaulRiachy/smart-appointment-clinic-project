import { noShowCutoff } from '../../domain/appointments/appointment.rules';
import type { Dependencies } from '../ports';
export function createNoShowUseCase(deps: Dependencies) {
    return async function runNoShowJob(): Promise<number> {
        const modifiedCount = await deps.appointments.markNoShows(noShowCutoff());
        if (modifiedCount > 0)
            console.log(`No-show job marked ${modifiedCount} appointment(s) as NO_SHOW.`);
        return modifiedCount;
    };
}
