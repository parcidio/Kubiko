import BeeznoFilters from "../../../components/arrendatario/Filters";
import BeeznoItems from "../../../components/arrendatario/Items";

export default function Arrendatario()
{
    return (
        <div className="bg-background flex mx-auto max-w-6xl">
            <BeeznoFilters />
            <BeeznoItems />
        </div>
    );
}